import { create } from "zustand";
import type { AuthSession } from "@/types";
import {
  login,
  readStoredSession,
  signup,
  signOut as endSession,
  type AuthResult,
  type LoginInput,
  updateProfile,
  type SignupInput,
} from "@/services/authService";

interface AuthState {
  session: AuthSession | null;
  /** Runs the sign-in and keeps the session in this browser when it succeeds. */
  signIn: (input: LoginInput) => Promise<AuthResult>;
  createAccount: (input: SignupInput) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  /** Renames the signed-in account; the plan and email are not editable here. */
  rename: (name: string) => Promise<AuthResult>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: readStoredSession(),

  signIn: async (input) => {
    const result = await login(input);
    if (result.status === "ok") set({ session: result.session });
    return result;
  },

  createAccount: async (input) => {
    const result = await signup(input);
    if (result.status === "ok") set({ session: result.session });
    return result;
  },

  signOut: async () => {
    await endSession();
    set({ session: null });
  },

  rename: async (name) => {
    const current = get().session;
    if (!current) {
      return { status: "error", error: { code: "auth", message: "Sign in to edit a profile." } };
    }
    const result = await updateProfile(current, { name });
    if (result.status === "ok") set({ session: result.session });
    return result.status === "ok" ? { status: "ok", session: result.session } : result;
  },
}));

export function useAuthSession(): AuthSession | null {
  return useAuthStore((state) => state.session);
}

export function useIsSignedIn(): boolean {
  return useAuthStore((state) => state.session !== null);
}
