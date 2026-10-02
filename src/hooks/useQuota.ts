import { useCallback } from "react";
import type { Plan, ToolId } from "@/types";
import { canRun, quotaError, recordUsage, type QuotaCheck } from "@/services/usageService";
import { useAuthSession } from "@/store/authStore";

export interface QuotaGuard {
  /** The plan the run is measured against. */
  plan: Plan;
  /** False when nobody is signed in, in which case the counters are this device's. */
  signedIn: boolean;
  /** Cheap, writes nothing: call before a run starts. */
  check: (words: number) => QuotaCheck;
  /** Call once a run has actually finished, so a failure costs nothing. */
  record: (words: number) => void;
}

/**
 * Plan limits read from the published plan table, so a page never restates a number
 * that could disagree with the pricing page.
 */
export function useQuota(tool: ToolId): QuotaGuard {
  const session = useAuthSession();
  const plan: Plan = session?.user.plan ?? "free";

  const check = useCallback((words: number) => canRun(plan, tool, words), [plan, tool]);
  const record = useCallback((words: number) => {
    recordUsage(tool, words);
  }, [tool]);

  return { plan, signedIn: session !== null, check, record };
}

export { quotaError };
