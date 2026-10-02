import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/loader";

import { toServiceError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Plan } from "@/types";
import { useAuthSession } from "@/store/authStore";
import {
  getBillingCapabilities,
  startCheckout,
  type BillingCycle,
} from "@/services/subscriptionService";

interface CheckoutButtonProps {
  plan: Plan;
  cycle: BillingCycle;
  label: string;
  highlighted?: boolean;
  className?: string;
}

/**
 * Checkout, as far as a browser is allowed to take it: ask the billing service for a
 * session, then hand the tab to the provider. A successful click here is never reported
 * as a successful payment — only the provider's webhook confirms that.
 */
export function CheckoutButton({ plan, cycle, label, highlighted, className }: CheckoutButtonProps) {
  const session = useAuthSession();
  const capabilities = getBillingCapabilities();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const onThisPlan = session?.user.plan === plan;

  if (!session) {
    return (
      <div className={cn("space-y-2", className)}>
        <Button asChild variant={highlighted ? "default" : "outline"} className="w-full">
          <Link to="/login">
            {label}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </Button>
        <p className="text-center text-2xs text-muted-foreground">
          Sign in first — a plan change is recorded against an account, not a browser.
        </p>
      </div>
    );
  }

  if (onThisPlan) {
    return (
      <div className={cn("space-y-2", className)}>
        <Button variant="outline" className="w-full" disabled>
          Your current plan
        </Button>
        <p className="text-center text-2xs text-muted-foreground">
          This session is on {plan === "free" ? "Free" : "the paid plan"} already. Quotas are on the{" "}
          <Link to="/usage" className="underline underline-offset-2">
            Usage page
          </Link>
          .
        </p>
      </div>
    );
  }

  async function checkout() {
    setBusy(true);
    setNotice(null);
    try {
      const outcome = await startCheckout(plan, cycle);
      if (outcome.status === "redirect") {
        // Leaving the app is the only thing this button can honestly do.
        window.location.assign(outcome.url);
        return;
      }
      setNotice(`${outcome.error.message}${outcome.error.hint ? ` ${outcome.error.hint}` : ""}`);
    } catch (error) {
      const serviceError = toServiceError(error);
      setNotice(`${serviceError.message}${serviceError.hint ? ` ${serviceError.hint}` : ""}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Button
        type="button"
        variant={highlighted ? "default" : "outline"}
        className="w-full"
        onClick={() => void checkout()}
        disabled={busy}
      >
        {busy ? <Spinner size="sm" /> : <CreditCard className="size-3.5" aria-hidden />}
        {busy ? "Opening checkout…" : label}
      </Button>
      <p
        className={cn(
          "text-center text-2xs leading-relaxed",
          notice ? "text-warning" : "text-muted-foreground",
        )}
        aria-live="polite"
      >
        {notice ??
          (capabilities.serviceAttached
            ? "You leave this page for the provider. Nothing changes until they confirm it."
            : "Checkout is not available in this build — the billing note above says why.")}
      </p>
    </div>
  );
}

/** One line, printed once per page, that says what this build can and cannot bill for. */
export function BillingNotice({ className }: { className?: string }) {
  const capabilities = getBillingCapabilities();
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface-sunken px-3 py-2.5 text-2xs leading-relaxed text-muted-foreground",
        className,
      )}
      role="note"
    >
      <p className="font-medium text-foreground">
        Billing provider: {capabilities.provider}. Checkout service:{" "}
        {capabilities.serviceAttached ? "attached" : "not attached"}.
      </p>
      <p className="mt-1">{capabilities.note}</p>
      <p className="mt-1">
        {capabilities.pricedPlans.length > 0
          ? `Prices configured: ${capabilities.pricedPlans.join(", ")}.`
          : "No Stripe price ids are configured, so no plan here can be purchased."}
        {capabilities.missingPrices.length > 0
          ? ` Missing: ${capabilities.missingPrices.join(", ")}.`
          : ""}
      </p>
    </div>
  );
}
