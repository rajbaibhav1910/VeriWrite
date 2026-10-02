import { useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Info, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorState } from "@/components/ui/error-state";
import { useToast } from "@/components/ui/toast";
import { useAuthStore } from "@/store/authStore";
import {
  DEMO_SESSION_NOTICE,
  getAuthCapabilities,
  isValidEmail,
  passwordStrength,
} from "@/services/authService";
import type { ServiceError } from "@/types";
import { cn } from "@/lib/utils";

interface AuthFormPageProps {
  mode: "login" | "signup";
}

interface FormValues {
  name: string;
  email: string;
  password: string;
  remember: boolean;
  acceptTerms: boolean;
}

const EMPTY: FormValues = { name: "", email: "", password: "", remember: false, acceptTerms: false };

/** Only same-origin paths are safe to send a signed-in user to. */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

function errorCopy(error: ServiceError): string {
  switch (error.code) {
    case "auth":
      return "We could not sign you in with those details. Check the email address and password.";
    case "rate_limited":
      return "Too many attempts for now. Wait a moment and try again.";
    case "network":
      return "We could not reach the auth service. Check your connection.";
    case "timeout":
      return "The auth service took too long to answer. Try again.";
    default:
      return error.message;
  }
}

export function AuthFormPage({ mode }: AuthFormPageProps) {
  const isSignup = mode === "signup";
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const signIn = useAuthStore((state) => state.signIn);
  const createAccount = useAuthStore((state) => state.createAccount);

  const [values, setValues] = useState<FormValues>(EMPTY);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [serverError, setServerError] = useState<ServiceError | null>(null);
  const [pending, setPending] = useState(false);

  const capabilities = getAuthCapabilities();
  const strength = useMemo(() => passwordStrength(values.password), [values.password]);
  const next = safeNext(new URLSearchParams(location.search).get("next"));

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setServerError(null);
  };

  const validate = () => {
    const errors: Partial<Record<keyof FormValues, string>> = {};
    if (!isValidEmail(values.email)) errors.email = "Enter a valid email address.";
    if (values.password.length < 8) errors.password = "Use at least 8 characters.";
    if (isSignup && values.name.trim().length < 2) errors.name = "Tell us what to call you.";
    if (isSignup && !values.acceptTerms) {
      errors.acceptTerms = "Accept the terms and privacy policy to continue.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setServerError(null);
    if (!validate()) return;
    setPending(true);
    try {
      const email = values.email.trim();
      const result = isSignup
        ? await createAccount({ name: values.name.trim(), email, password: values.password, remember: values.remember })
        : await signIn({ email, password: values.password, remember: values.remember });

      if (result.status === "error") {
        setServerError(result.error);
        return;
      }

      toast({
        variant: "success",
        title: result.session.mode === "local-demo"
          ? "Demo session started in this browser"
          : `Welcome, ${result.session.user.name}`,
        description: result.session.mode === "local-demo"
          ? "Nothing was verified or sent. Connect an auth service for real accounts."
          : undefined,
      });
      navigate(next, { replace: true });
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className="border-border/70 p-6 shadow-raised">
      <h1 className="text-xl font-semibold tracking-tight">
        {isSignup ? "Create your VeriWrite account" : "Welcome back"}
      </h1>
      <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
        {isSignup
          ? "Free plan includes 20 detection analyses and 5,000 words a month."
          : "Sign in to pick up your documents, history and reports."}
      </p>

      {capabilities.runningLocally && (
        <div
          className="mt-4 flex gap-2.5 rounded-md border border-info/25 bg-info-soft p-3 text-2xs leading-relaxed text-info"
          role="note"
        >
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>{DEMO_SESSION_NOTICE}</span>
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
        {isSignup && (
          <div className="space-y-1.5">
            <Label htmlFor="auth-name">Full name</Label>
            <Input
              id="auth-name"
              autoComplete="name"
              value={values.name}
              onChange={(event) => set("name", event.target.value)}
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? "auth-name-error" : undefined}
              placeholder="Alex Moreau"
            />
            {fieldErrors.name && (
              <p id="auth-name-error" className="text-2xs text-error">
                {fieldErrors.name}
              </p>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="auth-email">Email</Label>
          <div className="relative">
            <Mail
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="auth-email"
              type="email"
              autoComplete="email"
              className="pl-9"
              value={values.email}
              onChange={(event) => set("email", event.target.value)}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? "auth-email-error" : undefined}
              placeholder="you@studio.com"
            />
          </div>
          {fieldErrors.email && (
            <p id="auth-email-error" className="text-2xs text-error">
              {fieldErrors.email}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="auth-password">Password</Label>
            {!isSignup && (
              <Link
                to="/forgot-password"
                className="text-2xs font-medium text-primary underline-offset-4 hover:underline"
              >
                Forgot password?
              </Link>
            )}
          </div>
          <div className="relative">
            <Input
              id="auth-password"
              type={showPassword ? "text" : "password"}
              autoComplete={isSignup ? "new-password" : "current-password"}
              className="pr-10"
              value={values.password}
              onChange={(event) => set("password", event.target.value)}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={
                fieldErrors.password
                  ? "auth-password-error"
                  : isSignup
                    ? "auth-password-strength"
                    : undefined
              }
              placeholder="At least 8 characters"
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-xs p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              {showPassword ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>

          {isSignup && (
            <div id="auth-password-strength" className="flex items-center gap-2">
              <div className="flex h-1 flex-1 gap-1" aria-hidden="true">
                {[1, 2, 3, 4].map((step) => (
                  <span
                    key={step}
                    className={cn(
                      "flex-1 rounded-full bg-muted transition-colors",
                      strength.score >= step &&
                        (strength.score <= 1
                          ? "bg-error"
                          : strength.score === 2
                            ? "bg-warning"
                            : "bg-success"),
                    )}
                  />
                ))}
              </div>
              <span className="w-24 shrink-0 text-2xs text-muted-foreground">
                {values.password.length === 0 ? "Password strength" : strength.label}
              </span>
            </div>
          )}

          {isSignup && values.password.length > 0 && strength.score < 4 && (
            <ul className="flex flex-wrap gap-x-3 gap-y-1 text-2xs text-muted-foreground">
              {strength.checks
                .filter((check) => !check.met)
                .map((check) => (
                  <li key={check.label} className="inline-flex items-center gap-1">
                    <span className="size-1 rounded-full bg-muted-foreground" aria-hidden="true" />
                    {check.label}
                  </li>
                ))}
            </ul>
          )}

          {fieldErrors.password && (
            <p id="auth-password-error" className="text-2xs text-error">
              {fieldErrors.password}
            </p>
          )}
        </div>

        {!isSignup && (
          <div className="flex items-center gap-2">
            <input
              id="auth-remember"
              type="checkbox"
              checked={values.remember}
              onChange={(event) => set("remember", event.target.checked)}
              className="size-4 shrink-0 rounded-xs border border-border accent-[var(--primary)]"
            />
            <Label htmlFor="auth-remember" className="cursor-pointer text-2xs font-normal text-muted-foreground">
              Keep me signed in on this device
            </Label>
          </div>
        )}

        {isSignup && (
          <div className="space-y-1.5">
            <div className="flex items-start gap-2">
              <input
                id="auth-terms"
                type="checkbox"
                checked={values.acceptTerms}
                onChange={(event) => set("acceptTerms", event.target.checked)}
                aria-invalid={Boolean(fieldErrors.acceptTerms)}
                aria-describedby={fieldErrors.acceptTerms ? "auth-terms-error" : undefined}
                className="mt-0.5 size-4 shrink-0 rounded-xs border border-border accent-[var(--primary)]"
              />
              <Label
                htmlFor="auth-terms"
                className="cursor-pointer text-2xs font-normal leading-relaxed text-muted-foreground"
              >
                I agree to the{" "}
                <Link to="/legal/terms" className="text-primary underline underline-offset-2">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link to="/legal/privacy" className="text-primary underline underline-offset-2">
                  Privacy Policy
                </Link>
                , and understand that detection results are probabilistic estimates.
              </Label>
            </div>
            {fieldErrors.acceptTerms && (
              <p id="auth-terms-error" className="text-2xs text-error">
                {fieldErrors.acceptTerms}
              </p>
            )}
          </div>
        )}

        {serverError && (
          <ErrorState
            compact
            className="items-start text-left"
            error={{ ...serverError, message: errorCopy(serverError) }}
          />
        )}

        <Button type="submit" size="md" className="w-full" loading={pending}>
          {isSignup ? "Create account" : "Sign in"}
        </Button>
      </form>

      <p className="mt-5 flex items-center justify-center gap-1.5 border-t border-border pt-4 text-center text-2xs text-muted-foreground">
        {isSignup ? (
          <>
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New to VeriWrite?{" "}
            <Link to="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
              Create an account
            </Link>
          </>
        )}
      </p>

      <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-2xs text-muted-foreground">
        <ShieldCheck className="size-3.5 shrink-0 text-success" aria-hidden="true" />
        {capabilities.runningLocally
          ? "Demo mode keeps this session in your browser. No password or document text leaves this device."
          : "Passwords are handled by the auth service over TLS and never stored in this app."}
      </p>
    </Card>
  );
}
