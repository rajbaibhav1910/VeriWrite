import { useCallback, useEffect, useState } from "react";
import type { Plan, ServiceError } from "@/types";
import { backendConfigured, toServiceError } from "@/lib/api";
import {
  getUsageSnapshot,
  usageSnapshotLocal,
  type UsageSnapshot,
} from "@/services/usageService";

export interface UsageState {
  status: "loading" | "ready" | "error";
  snapshot: UsageSnapshot | null;
  error: ServiceError | null;
  reload: () => void;
}

/**
 * The usage figures for a plan. Without a service the snapshot is built during the
 * first render, because the numbers are already on this device and a loading state
 * for data the tab can read would be a lie about how slow the page is.
 */
export function useUsageSnapshot(plan: Plan, span?: number): UsageState {
  const [snapshot, setSnapshot] = useState<UsageSnapshot | null>(() =>
    backendConfigured() ? null : usageSnapshotLocal(plan, span),
  );
  const [error, setError] = useState<ServiceError | null>(null);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const next = await getUsageSnapshot(plan, span);
        if (!active) return;
        setSnapshot(next);
        setError(null);
      } catch (caught) {
        if (!active) return;
        setError(toServiceError(caught));
      }
    })();
    return () => {
      active = false;
    };
  }, [plan, span, nonce]);

  return {
    status: error ? "error" : snapshot ? "ready" : "loading",
    snapshot,
    error,
    reload,
  };
}
