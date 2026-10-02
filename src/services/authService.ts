import type { AuthMode, AuthSession, AuthUser, Plan, ServiceError } from "@/types";
import { apiRequest, backendConfigured, toServiceError } from "@/lib/api";
import { STORAGE_KEYS, readJson, remove, writeJson } from "@/lib/storage";
import { requireRecord, requireString } from "@/lib/service";
import { uid } from "@/lib/utils";

/**
 * Session handling for the app.
 *
 * With a backend attached, credentials go to the auth service and the session is
 * whatever that service returns (the request itself sends cookies, so no token is
 * ever held in this browser's storage). Without one, signing in creates a session
 * in this browser and says so out loud — see DEMO_SESSION_NOTICE. The password is
 * never checked locally, because nothing here could check it.
 */

export const SHORT_SESSION_HOURS = 8;
export const REMEMBER_SESSION_DAYS = 30;

export const DEMO_SESSION_NOTICE =
  "No authentication service is attached, so this form runs in demo mode: signing in stores a session in this browser only. The password is not verified, no account is created, and nothing is sent to a server.";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u;
const PLAN_IDS: Plan[] = ["free", "pro", "team"];

export interface LoginInput {
  email: string;
  password: string;
  remember?: boolean;
}

export interface SignupInput {
  name: string;
  email: string;
  password: string;
  remember?: boolean;
}

export type AuthResult =
  | { status: "ok"; session: AuthSession }
  | { status: "error"; error: ServiceError };

export interface AuthCapabilities {
  /** False only when the auth service is reachable over HTTP. */
  runningLocally: boolean;
  emailPassword: true;
  /** Single sign-on needs a backend to exchange codes with; never offered without one. */
  singleSignOn: boolean;
  passwordReset: boolean;
  sessionScope: "this browser" | "auth service";
}

export function getAuthCapabilities(): AuthCapabilities {
  const remote = backendConfigured();
  return {
    runningLocally: !remote,
    emailPassword: true,
    singleSignOn: remote,
    passwordReset: remote,
    sessionScope: remote ? "auth service" : "this browser",
  };
}

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  checks: { label: string; met: boolean }[];
}

/** Mirrors what a real policy enforces so the form can say which rule is unmet. */
export function passwordStrength(password: string): PasswordStrength {
  const checks = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "Upper and lower case", met: /[a-z]/u.test(password) && /[A-Z]/u.test(password) },
    { label: "At least one number", met: /\d/u.test(password) },
    { label: "At least one symbol", met: /[^A-Za-z0-9]/u.test(password) },
  ];
  const met = checks.filter((check) => check.met).length;
  const score = (password.length === 0 ? 0 : Math.max(1, met)) as PasswordStrength["score"];
  return {
    score,
    label: ["Empty", "Weak", "Fair", "Strong", "Very strong"][score],
    checks,
  };
}

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/u).filter(Boolean);
  if (words.length === 0) return "?";
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();
}

/** "ada.lovelace" reads better in a header than an email address does. */
function nameFromEmail(email: string): string {
  const local = email.trim().split("@")[0] ?? "";
  const words = local
    .replace(/[^A-Za-z]+/gu, " ")
    .trim()
    .split(/\s+/u)
    .filter((word) => word.length > 2);
  if (words.length === 0) return email.trim();
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
}

function sessionExpiresAt(remember: boolean | undefined, from = Date.now()): string {
  const ms = remember
    ? REMEMBER_SESSION_DAYS * 24 * 60 * 60 * 1000
    : SHORT_SESSION_HOURS * 60 * 60 * 1000;
  return new Date(from + ms).toISOString();
}

function guardPlan(value: unknown): Plan {
  return typeof value === "string" && (PLAN_IDS as string[]).includes(value)
    ? (value as Plan)
    : "free";
}

/** The auth service response is untrusted input like any other remote payload. */
function guardUser(payload: unknown): AuthUser {
  const record = requireRecord(payload, "auth");
  const user = typeof record.user === "object" && record.user !== null
    ? requireRecord(record.user, "auth")
    : record;
  const email = requireString(user, "email", "auth");
  const name = typeof user.name === "string" && user.name.trim().length > 0 ? user.name : nameFromEmail(email);
  return {
    id: typeof user.id === "string" && user.id.length > 0 ? user.id : uid("user"),
    name,
    email,
    plan: guardPlan(user.plan),
    avatarInitials: typeof user.avatarInitials === "string" && user.avatarInitials.length > 0
      ? user.avatarInitials
      : initialsOf(name),
    joinedAt: typeof user.joinedAt === "string" ? user.joinedAt : new Date().toISOString(),
  };
}

function remoteSession(payload: unknown, remember?: boolean): AuthSession {
  const record = requireRecord(payload, "auth");
  const expiresAt = typeof record.expiresAt === "string"
    ? record.expiresAt
    : sessionExpiresAt(remember);
  return { user: guardUser(record), mode: "remote", issuedAt: new Date().toISOString(), expiresAt };
}

function demoSession(input: { email: string; name?: string }, mode: AuthMode, remember?: boolean): AuthSession {
  const email = input.email.trim();
  const name = input.name && input.name.trim().length > 0 ? input.name.trim() : nameFromEmail(email);
  return {
    user: {
      // Derived from the address so the same email resumes the same demo identity.
      id: `demo-${email.toLowerCase().replace(/[^a-z0-9]+/gu, "-")}`,
      name,
      email,
      plan: "free",
      avatarInitials: initialsOf(name),
      joinedAt: new Date().toISOString(),
    },
    mode,
    issuedAt: new Date().toISOString(),
    expiresAt: sessionExpiresAt(remember),
  };
}

function failure(error: unknown): AuthResult {
  return { status: "error", error: toServiceError(error) };
}

/**
 * Local sign-in deliberately ignores the password: it cannot verify one, and
 * pretending to would be the one thing a user could not forgive.
 */
function localResult(input: { email: string; name?: string }, mode: AuthMode, remember?: boolean): AuthResult {
  if (!isValidEmail(input.email)) {
    return {
      status: "error",
      error: { code: "auth", message: "That email address is not valid.", hint: "Check for a typo." },
    };
  }
  return { status: "ok", session: storeSession(demoSession(input, mode, remember)) };
}

export async function login(input: LoginInput): Promise<AuthResult> {
  if (!backendConfigured()) return localResult(input, "local-demo", input.remember);
  try {
    const payload = await apiRequest<unknown>("/api/auth/login", {
      method: "POST",
      body: { email: input.email.trim(), password: input.password },
    });
    return { status: "ok", session: storeSession(remoteSession(payload, input.remember)) };
  } catch (error) {
    return failure(error);
  }
}

export async function signup(input: SignupInput): Promise<AuthResult> {
  if (!backendConfigured()) {
    return localResult(
      { email: input.email, name: input.name },
      "local-demo",
      input.remember,
    );
  }
  try {
    const payload = await apiRequest<unknown>("/api/auth/signup", {
      method: "POST",
      body: { name: input.name.trim(), email: input.email.trim(), password: input.password },
    });
    return { status: "ok", session: storeSession(remoteSession(payload, input.remember)) };
  } catch (error) {
    return failure(error);
  }
}

export async function signOut(): Promise<void> {
  if (backendConfigured()) {
    // Best-effort: a failed logout must not leave a usable session behind.
    try {
      await apiRequest<void>("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignored on purpose — the local session is cleared either way.
    }
  }
  clearStoredSession();
}

export interface ResetOutcome {
  status: "sent" | "error";
  message: string;
  hint?: string;
}

/**
 * Password reset always answers the same way, because confirming an address exists
 * is itself a leak. In demo mode there is no mailer, so it says so instead of
 * pretending an email went out.
 */
export async function requestPasswordReset(email: string): Promise<ResetOutcome> {
  if (!backendConfigured()) {
    return {
      status: "error",
      message: "No reset email can be sent.",
      hint: "This copy of VeriWrite has no auth service attached, so it cannot mail a reset link.",
    };
  }
  try {
    await apiRequest<unknown>("/api/auth/password-reset", {
      method: "POST",
      body: { email: email.trim() },
    });
  } catch (error) {
    const serviceError = toServiceError(error);
    if (serviceError.code !== "auth" && serviceError.code !== "api") {
      return { status: "error", message: serviceError.message, hint: serviceError.hint };
    }
  }
  return {
    status: "sent",
    message: "If that address has an account, a reset link is on its way.",
  };
}

export interface ProfileInput {
  name: string;
}

export type ProfileResult =
  | { status: "ok"; session: AuthSession; where: "auth service" | "this browser" }
  | { status: "error"; error: ServiceError };

/**
 * The display name only. An email is the account key and a plan is a billing record, so
 * neither is editable from a profile form; both change through auth and billing instead.
 */
export async function updateProfile(session: AuthSession, input: ProfileInput): Promise<ProfileResult> {
  const name = input.name.trim();
  if (name.length < 2) {
    return {
      status: "error",
      error: { code: "auth", message: "A display name needs at least 2 characters." },
    };
  }
  if (name.length > 80) {
    return {
      status: "error",
      error: { code: "auth", message: "A display name is capped at 80 characters." },
    };
  }

  const renamed: AuthSession = {
    ...session,
    user: { ...session.user, name, avatarInitials: initialsOf(name) },
  };

  if (!backendConfigured()) {
    // The demo session belongs to this browser, so writing it back is the whole change.
    return { status: "ok", session: storeSession(renamed), where: "this browser" };
  }
  try {
    const payload = await apiRequest<unknown>("/api/auth/profile", {
      method: "POST",
      body: { name },
    });
    const updated = guardUser(payload);
    const session2: AuthSession = { ...renamed, user: { ...updated, email: session.user.email } };
    return { status: "ok", session: storeSession(session2), where: "auth service" };
  } catch (error) {
    return { status: "error", error: toServiceError(error) };
  }
}

export function storeSession(session: AuthSession): AuthSession {
  writeJson(STORAGE_KEYS.session, session);
  return session;
}

export function clearStoredSession(): void {
  remove(STORAGE_KEYS.session);
}

export function isCurrent(session: AuthSession | null, at = Date.now()): session is AuthSession {
  if (!session) return false;
  const expiresAt = Date.parse(session.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > at;
}

/** Reads storage and drops an expired session rather than handing it back. */
export function readStoredSession(): AuthSession | null {
  const stored = readJson<AuthSession | null>(STORAGE_KEYS.session, null);
  if (!stored || typeof stored !== "object" || !stored.user || typeof stored.user.email !== "string") {
    return null;
  }
  if (!isCurrent(stored)) {
    clearStoredSession();
    return null;
  }
  return stored;
}
