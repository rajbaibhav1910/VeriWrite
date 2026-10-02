import { Check, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PLANS } from "@/config/plans";
import { cn } from "@/lib/utils";
import { useAuthSession } from "@/store/authStore";
import { BillingNotice, CheckoutButton } from "@/components/billing/CheckoutButton";

export function PricingPage() {
  const session = useAuthSession();
  return (
    <div className="mx-auto max-w-[76rem] px-4 py-14 sm:px-6 lg:px-8">
      <div>
        <header className="max-w-2xl">
          <Badge variant="secondary" size="sm">
            Plans
          </Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Start free. Upgrade when the analysis gets serious.
          </h1>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted-foreground">
            Every plan includes sentence-level detection output, the full disclaimer set and export
            of your own reports. Paid plans raise monthly quotas and unlock advanced reporting.
          </p>
        </header>

        <Tabs defaultValue="monthly" className="mt-8">
          <TabsList>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="annual">Annual · 2 months free</TabsTrigger>
          </TabsList>
          {(["monthly", "annual"] as const).map((cycle) => (
            <TabsContent key={cycle} value={cycle}>
              <div className="mt-6 grid gap-4 lg:grid-cols-3">
                {PLANS.map((plan) => (
                  <Card
                    key={plan.id}
                    className={cn(
                      "flex flex-col p-6",
                      plan.highlighted && "border-primary shadow-raised",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-base font-semibold">{plan.name}</h2>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {plan.audience}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {plan.highlighted && <Badge size="xs">Most popular</Badge>}
                        {session?.user.plan === plan.id && <Badge variant="secondary" size="xs">Your plan</Badge>}
                      </div>
                    </div>

                    <p className="mt-5 flex items-baseline gap-1">
                      <span className="text-3xl font-semibold tracking-tight tabular">
                        ${cycle === "monthly" ? plan.monthly : plan.annual}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        /{cycle === "monthly" ? "month" : "mo, billed yearly"}
                      </span>
                    </p>

                    <ul className="mt-5 flex-1 space-y-2.5">
                      {plan.features.map((feature) => (
                        <li key={feature.label} className="flex gap-2.5 text-[0.8125rem]">
                          {feature.included ? (
                            <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                          ) : (
                            <Minus className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                          )}
                          <span className={cn(!feature.included && "text-muted-foreground")}>
                            {feature.label}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <CheckoutButton
                      className="mt-6"
                      plan={plan.id}
                      cycle={cycle}
                      label={plan.cta}
                      highlighted={plan.highlighted}
                    />
                    <p className="mt-2 text-center text-2xs text-muted-foreground">
                      {plan.billingNote}
                    </p>
                  </Card>
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <section className="mt-14" aria-labelledby="quota-table">
          <h2 id="quota-table" className="text-lg font-semibold tracking-tight">
            Quotas at a glance
          </h2>
          <div className="mt-4 overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[36rem] border-collapse text-sm">
              <thead className="bg-surface text-left text-2xs uppercase tracking-[0.06em] text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Monthly allowance
                  </th>
                  {PLANS.map((plan) => (
                    <th key={plan.id} scope="col" className="px-4 py-3 text-right font-semibold">
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PLANS[0].quotas.map((_, rowIndex) => (
                  <tr key={PLANS[0].quotas[rowIndex].label} className="border-t border-border">
                    <th scope="row" className="px-4 py-3 text-left font-normal text-foreground">
                      {PLANS[0].quotas[rowIndex].label}
                    </th>
                    {PLANS.map((plan) => (
                      <td
                        key={plan.id}
                        className="px-4 py-3 text-right tabular text-muted-foreground"
                      >
                        {plan.quotas[rowIndex].value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <BillingNotice className="mt-4" />
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            A checkout session is created by the billing service and completed on the provider
            page. The plan behind these quotas changes only when the provider
            <code className="mx-1 font-mono text-3xs">checkout.session.completed</code> webhook
            confirms it to the service — this page never marks a payment as paid.
          </p>
        </section>
      </div>
    </div>
  );
}
