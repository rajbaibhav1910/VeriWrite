import type { Plan } from "@/types";

export interface PlanFeature {
  label: string;
  included: boolean;
}

export interface PlanQuota {
  label: string;
  /** This plan's allowance, kept as text so "5,000" and "Unlimited" render as written. */
  value: string;
}

export interface PlanDefinition {
  id: Plan;
  name: string;
  audience: string;
  monthly: number;
  /** Displayed price per month when billed yearly. */
  annual: number;
  highlighted: boolean;
  cta: string;
  billingNote: string;
  features: PlanFeature[];
  quotas: PlanQuota[];
}

const QUOTA_ROWS: Omit<PlanQuota, "value">[] = [
  { label: "AI detection analyses" },
  { label: "Words processed per month" },
  { label: "Paraphrasing runs" },
  { label: "Plagiarism scans" },
  { label: "Saved documents" },
  { label: "History retained" },
  { label: "Concurrent seats" },
];


export const PLANS: PlanDefinition[] = [
  {
    id: "free",
    name: "Free",
    audience: "Try the detector on real writing",
    monthly: 0,
    annual: 0,
    highlighted: false,
    cta: "Start free",
    billingNote: "No card required",
    features: [
      { label: "Sentence-level AI detection", included: true },
      { label: "Confidence and signal explanations", included: true },
      { label: "Paraphraser and grammar checker", included: true },
      { label: "PDF report export", included: false },
      { label: "Plagiarism source matching", included: false },
      { label: "Unlimited history", included: false },
    ],
    quotas: withValues(["20", "5,000", "50", "0", "10", "30 days", "1"]),
  },
  {
    id: "pro",
    name: "Pro",
    audience: "Students and professionals who analyse daily",
    monthly: 12,
    annual: 10,
    highlighted: true,
    cta: "Upgrade to Pro",
    billingNote: "Cancel any time from Account",
    features: [
      { label: "Everything in Free", included: true },
      { label: "Advanced four-class breakdown", included: true },
      { label: "Plagiarism source matching", included: true },
      { label: "Unlimited history and saved documents", included: true },
      { label: "Downloadable and shareable reports", included: true },
      { label: "Team seat management", included: false },
    ],
    quotas: withValues(["500", "250,000", "2,000", "100", "Unlimited", "Unlimited", "1"]),
  },
  {
    id: "team",
    name: "Team",
    audience: "Editorial, legal and academic groups",
    monthly: 39,
    annual: 32,
    highlighted: false,
    cta: "Talk to us",
    billingNote: "Invoiced billing and admin controls",
    features: [
      { label: "Everything in Pro", included: true },
      { label: "Shared workspace and folders", included: true },
      { label: "Admin controls and audit trail", included: true },
      { label: "Team usage analytics", included: true },
      { label: "Priority processing queue", included: true },
      { label: "Single sign-on", included: false },
    ],
    quotas: withValues(["2,500", "1,000,000", "10,000", "500", "Unlimited", "Unlimited", "5+"]),
  },
];

function withValues(values: string[]): PlanQuota[] {
  return QUOTA_ROWS.map((row, index) => ({ ...row, value: values[index] ?? "—" }));
}
