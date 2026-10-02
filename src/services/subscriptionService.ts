import type { Plan, ServiceError } from "@/types";
import { PLANS } from "@/config/plans";
import { ApiError, apiRequest, backendConfigured } from "@/lib/api";
import { optionalNumber, requireRecord, requireString } from "@/lib/service";

/**
 * Billing boundary.
 *
 * Stripe is the intended provider, and this module is shaped for it: a checkout session is
 * created by the service, redirected to by the browser, and confirmed later by a webhook.
 * Nothing here can mark a payment as paid. Without a service attached every entry point
 * returns a stated refusal, because a plan that changed without money moving would be a
 * record nobody can trust.
 */

export type BillingCycle = "monthly" | "annual";

export const BILLING_CYCLES: { id: BillingCycle; label: string; suffix: string }[] = [
  { id: "monthly", label: "Monthly", suffix: "/month" },
  { id: "annual", label: "Annual", suffix: "/month, billed yearly" },
];

/** Paid plans only: Free has no price to point at. */
const PRICE_ENV: Record<Exclude<Plan, "free">, Record<BillingCycle, string>> = {
  pro: {
    monthly: "VITE_STRIPE_PRICE_PRO_MONTHLY",
    annual: "VITE_STRIPE_PRICE_PRO_ANNUAL",
  },
  team: {
    monthly: "VITE_STRIPE_PRICE_TEAM_MONTHLY",
    annual: "VITE_STRIPE_PRICE_TEAM_ANNUAL",
  },
};

function environmentValue(name: string): string {
  const env = import.meta.env as Record<string, string | undefined> | undefined;
  return (env?.[name] ?? "").trim();
}

export interface PriceReference {
  plan: Plan;
  cycle: BillingCycle;
  /** The publishable Stripe price id, or null when it has not been configured. */
  priceId: string | null;
  /** The environment variable that should hold it, printed so an operator can fix it. */
  envVar: string | null;
}

/** A price id is a publishable identifier, never a secret: it is safe to send from the browser. */
export function priceReference(plan: Plan, cycle: BillingCycle): PriceReference {
  if (plan === "free") return { plan, cycle, priceId: null, envVar: null };
  const envVar = PRICE_ENV[plan][cycle];
  const priceId = environmentValue(envVar);
  return { plan, cycle, priceId: priceId.length > 0 ? priceId : null, envVar };
}

export interface BillingCapabilities {
  /** The only provider this build knows how to talk to. */
  provider: "stripe";
  /** True when a billing service is attached; only it can open a real checkout. */
  serviceAttached: boolean;
  pricedPlans: string[];
  missingPrices: string[];
  /** Printed beside every checkout button so the state of billing is never a guess. */
  note: string;
}

export function getBillingCapabilities(): BillingCapabilities {
  const attached = backendConfigured();
  const priced: string[] = [];
  const missing: string[] = [];
  for (const plan of ["pro", "team"] as const) {
    for (const cycle of BILLING_CYCLES) {
      const label = `${plan} ${cycle.id}`;
      if (priceReference(plan, cycle.id).priceId) priced.push(label);
      else missing.push(label);
    }
  }
  return {
    provider: "stripe",
    serviceAttached: attached,
    pricedPlans: priced,
    missingPrices: missing,
    note: attached
      ? "Checkout is opened by the billing service. This page never marks a payment as complete."
      : "No billing service is attached to this build, so no plan can be purchased here. Set VITE_API_BASE_URL to connect one.",
  };
}

/** Which paid plan a card is for, and for how long. Sent to the service, never trusted from it. */
export interface CheckoutRequest {
  plan: Exclude<Plan, "free">;
  cycle: BillingCycle;
  priceId: string;
}

export type CheckoutOutcome =
  | {
      status: "redirect";
      /** Stripe-hosted URL. The browser leaves the app; the plan changes only after the webhook. */
      url: string;
      sessionId: string;
      expiresAt: string | null;
    }
  | { status: "unavailable"; error: ServiceError };

function unavailable(message: string, hint?: string): CheckoutOutcome {
  return { status: "unavailable", error: { code: "api", message, hint } };
}

/**
 * A URL that came back from a service is only followed when it is a real http(s) address;
 * `javascript:` or `data:` would navigate the app itself.
 */
export function safeBillingUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function checkoutRequest(plan: Plan, cycle: BillingCycle): CheckoutRequest | ServiceError {
  if (plan === "free") {
    return {
      code: "api",
      message: "The Free plan has nothing to check out. It is the plan every account starts on.",
    };
  }
  const reference = priceReference(plan, cycle);
  if (!reference.priceId) {
    return {
      code: "api",
      message: `No price is configured for ${planName(plan)}, billed ${cycle}.`,
      hint: `Set ${reference.envVar} to the Stripe price id for this plan and cycle.`,
    };
  }
  return { plan, cycle, priceId: reference.priceId };
}

/** Ask the billing service for a Stripe checkout session. Never simulates one. */
export async function startCheckout(
  plan: Plan,
  cycle: BillingCycle,
  signal?: AbortSignal,
): Promise<CheckoutOutcome> {
  // The service is the first requirement: without it no price could be checked out at all.
  if (!backendConfigured()) {
    return unavailable(
      getBillingCapabilities().note,
      "No payment was started and this account's plan has not changed.",
    );
  }
  const request = checkoutRequest(plan, cycle);
  if ("code" in request) return unavailable(request.message, request.hint);

  try {
    const response = await apiRequest<unknown>("/billing/checkout-session", {
      method: "POST",
      body: request,
      signal,
    });
    const record = requireRecord(response, "billing");
    const url = safeBillingUrl(record.url);
    if (!url) {
      return unavailable(
        "The billing service replied without a usable checkout address.",
        "No payment was started. Check the provider configuration server-side.",
      );
    }
    const expiresAt = typeof record.expiresAt === "string" ? record.expiresAt : null;
    return {
      status: "redirect",
      url,
      sessionId: typeof record.id === "string" ? record.id : requireString(record, "sessionId", "billing"),
      expiresAt,
    };
  } catch (error) {
    if (error instanceof ApiError && error.code === "auth") {
      return unavailable(
        "Sign in before starting checkout, so the plan change lands on an account.",
        "Your plan has not changed.",
      );
    }
    throw error;
  }
}

export type PortalOutcome =
  | { status: "redirect"; url: string }
  | { status: "unavailable"; error: ServiceError };

/** The provider's own customer portal: invoices, card details and cancellation live there. */
export async function openBillingPortal(signal?: AbortSignal): Promise<PortalOutcome> {
  if (!backendConfigured()) {
    return unavailable(
      "Managing a subscription needs the billing service, which this build is not attached to.",
      "Invoices, card details and cancellation are all handled by the provider's portal.",
    );
  }
  const response = await apiRequest<unknown>("/billing/portal-session", { method: "POST", signal });
  const url = safeBillingUrl(requireRecord(response, "billing").url);
  if (!url) {
    return unavailable("The billing service replied without a usable portal address.");
  }
  return { status: "redirect", url };
}

export const SUBSCRIPTION_STATUSES = [
  "active",
  "trialing",
  "past_due",
  "canceled",
  "incomplete",
  "unsubscribed",
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  active: "Active",
  trialing: "Trial",
  past_due: "Payment due",
  canceled: "Cancelled",
  incomplete: "Setup incomplete",
  unsubscribed: "No subscription",
};

export interface SubscriptionState {
  plan: Plan;
  planName: string;
  status: SubscriptionStatus;
  cycle: BillingCycle | null;
  /** ISO date the paid period ends, when the service reports one. */
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  /** Price as published on the plan table, so this page and the pricing page agree. */
  price: number | null;
  /** Where the record was read from, printed next to the status. */
  source: "billing service" | "this browser's session";
  note: string;
}

export function planName(plan: Plan): string {
  return PLANS.find((entry) => entry.id === plan)?.name ?? plan;
}

function publishedPrice(plan: Plan, cycle: BillingCycle): number | null {
  const definition = PLANS.find((entry) => entry.id === plan);
  if (!definition) return null;
  return cycle === "monthly" ? definition.monthly : definition.annual;
}

/**
 * The subscription a signed-in account is on. Locally there is no subscription to read:
 * the session carries a plan, and this says so instead of inventing periods and invoices.
 */
export async function getSubscription(sessionPlan: Plan): Promise<SubscriptionState> {
  if (!backendConfigured()) {
    return {
      plan: sessionPlan,
      planName: planName(sessionPlan),
      status: sessionPlan === "free" ? "unsubscribed" : "active",
      cycle: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      price: publishedPrice(sessionPlan, "monthly"),
      source: "this browser's session",
      note:
        sessionPlan === "free"
          ? "This demo session has the Free plan's quotas. It is not a subscription."
          : "This plan came from the local demo session, not from a payment. It is what the quotas on the Usage page are measured against.",
    };
  }

  const response = requireRecord(await apiRequest<unknown>("/billing/subscription"), "billing");
  const rawPlan = String(response.plan ?? "free") as Plan;
  const plan: Plan = PLANS.some((entry) => entry.id === rawPlan) ? rawPlan : "free";
  const rawStatus = String(response.status ?? "active");
  const status: SubscriptionStatus = SUBSCRIPTION_STATUSES.includes(rawStatus as SubscriptionStatus)
    ? (rawStatus as SubscriptionStatus)
    : "active";
  const rawCycle = response.cycle === "annual" ? "annual" : response.cycle === "monthly" ? "monthly" : null;
  return {
    plan,
    planName: planName(plan),
    status,
    cycle: rawCycle,
    currentPeriodEnd: typeof response.currentPeriodEnd === "string" ? response.currentPeriodEnd : null,
    cancelAtPeriodEnd: response.cancelAtPeriodEnd === true,
    price: rawCycle ? publishedPrice(plan, rawCycle) : null,
    source: "billing service",
    note: "Read from the billing service just now.",
  };
}

/** Events a Stripe webhook sends that change what this app shows. */
export const BILLING_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
] as const;

export type BillingWebhookType = (typeof BILLING_WEBHOOK_EVENTS)[number];

export interface BillingWebhook {
  type: BillingWebhookType;
  /** Stripe's `livemode`: a test-mode event must never move a real account. */
  livemode: boolean;
  created: number;
  customerId: string;
  subscriptionId: string | null;
  status: SubscriptionStatus;
  plan: Plan;
  cycle: BillingCycle | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

/**
 * The contract the receiving endpoint enforces. The frontend cannot verify a signature, so
 * this only checks the shape; the backend must reject anything whose Stripe signature fails
 * before it reaches this reader.
 */
export function readBillingWebhook(
  payload: unknown,
): { ok: true; webhook: BillingWebhook } | { ok: false; reason: string } {
  if (typeof payload !== "object" || payload === null) return { ok: false, reason: "The body is not an object." };
  const body = payload as Record<string, unknown>;
  const type = body.type;
  if (typeof type !== "string" || !(BILLING_WEBHOOK_EVENTS as readonly string[]).includes(type)) {
    return { ok: false, reason: `Unknown event type "${String(type)}".` };
  }
  const data = requireRecordSafe(body.data);
  const object = requireRecordSafe(data?.object);
  if (!object) return { ok: false, reason: "The event carries no object." };

  const status = String(object.status ?? "active");
  const rawPlan = String(object.plan ?? "free");
  return {
    ok: true,
    webhook: {
      type: type as BillingWebhookType,
      livemode: body.livemode === true,
      created: optionalNumber(body, "created"),
      customerId: typeof object.customer === "string" ? object.customer : "",
      subscriptionId: typeof object.subscription === "string" ? object.subscription : null,
      status: (SUBSCRIPTION_STATUSES as readonly string[]).includes(status)
        ? (status as SubscriptionStatus)
        : "active",
      plan: (PLANS.some((entry) => entry.id === rawPlan) ? rawPlan : "free") as Plan,
      cycle: object.interval === "year" ? "annual" : object.interval === "month" ? "monthly" : null,
      currentPeriodEnd:
        typeof object.current_period_end === "number"
          ? new Date(object.current_period_end * 1000).toISOString()
          : null,
      cancelAtPeriodEnd: object.cancel_at_period_end === true,
    },
  };
}

function requireRecordSafe(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

/** Whether an event moves the account's plan, per the contract above. */
export function webhookChangesPlan(webhook: BillingWebhook): boolean {
  // A failed invoice leaves the plan standing and only flags the payment; the rest restate it.
  return webhook.type !== "invoice.payment_failed";
}

/** What the plan becomes after an event. A failed payment keeps the plan and flags it. */
export function planAfterWebhook(webhook: BillingWebhook): Plan {
  return webhook.type === "customer.subscription.deleted" ? "free" : webhook.plan;
}
