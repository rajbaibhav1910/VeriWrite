import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, KeyRound, LogOut, ShieldCheck, Trash2, UserSquare2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { BillingNotice } from "@/components/billing/CheckoutButton";
import { AvatarWithFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/loader";
import { useToast } from "@/components/ui/toast";
import { DEMO_SESSION_NOTICE, getAuthCapabilities } from "@/services/authService";
import { getLibraryCapabilities, getWorkspaceStats } from "@/services/documentService";
import {
  SUBSCRIPTION_STATUS_LABEL,
  getSubscription,
  openBillingPortal,
  type SubscriptionState,
} from "@/services/subscriptionService";
import { backendConfigured } from "@/lib/api";
import { clearAllAppData } from "@/lib/storage";
import { formatDate, formatDateTime } from "@/lib/utils";
import { useAuthSession, useAuthStore } from "@/store/authStore";
import type { Plan } from "@/types";

/**
 * The account screen. Everything here says who the session believes you are and where that
 * belief came from; nothing pretends to reach a server that is not attached.
 */
export function AccountPage() {
  const session = useAuthSession();
  const capabilities = getAuthCapabilities();
  const stats = getWorkspaceStats();
  const library = getLibraryCapabilities();

  if (!session) return null;

  return (
    <>
      <PageHeader
        title="Account"
        description="Your session, the plan its quotas are measured against, and the data this browser holds."
        crumbs={[{ to: "/dashboard", label: "Workspace" }, { label: "Account" }]}
        actions={
          <Badge variant="outline" size="sm">
            {capabilities.sessionScope === "auth service" ? "Signed in with the auth service" : "Demo session, this browser"}
          </Badge>
        }
      />

      <div className="grid gap-4 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-3">
          <ProfileCard name={session.user.name} email={session.user.email} scope={capabilities.sessionScope} />
          <SubscriptionCard plan={session.user.plan} />
          <DataCard documents={stats.documents} analyses={stats.analyses} />
        </div>
        <div className="space-y-3">
          <SecurityCard issuedAt={session.issuedAt} expiresAt={session.expiresAt} mode={session.mode} />
          <Card className="p-4">
            <h2 className="flex items-center gap-1.5 text-xs font-semibold tracking-tight">
              <UserSquare2 className="size-3.5 text-primary" aria-hidden />
              What an account holds
            </h2>
            <ul className="mt-2 space-y-1.5 text-2xs leading-relaxed text-muted-foreground">
              <li>
                {library.backendConfigured ? (
                  <>
                    Your documents, folders and saved analyses are read from the attached library
                    service. This browser keeps only your drafts, preferences and usage counters,
                    under <code className="font-mono text-3xs">vw.</code> keys, and the{" "}
                    <Link to="/settings" className="underline underline-offset-2">
                      settings page
                    </Link>{" "}
                    controls whether those are kept at all.
                  </>
                ) : (
                  <>
                    Documents, history and reports are stored under{" "}
                    <code className="font-mono text-3xs">vw.</code> keys in this browser, and the{" "}
                    <Link to="/settings" className="underline underline-offset-2">
                      settings page
                    </Link>{" "}
                    controls whether new ones are kept at all.
                  </>
                )}
              </li>
              <li>
                Usage counters live on the{" "}
                <Link to="/usage" className="underline underline-offset-2">
                  Usage page
                </Link>
                . They are the plan limits applied to your runs, and they clear when the month rolls over.
              </li>
              <li>Deleting this browser&rsquo;s data is irreversible and is the only account action available offline.</li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

function ProfileCard({
  name,
  email,
  scope,
}: {
  name: string;
  email: string;
  scope: "this browser" | "auth service";
}) {
  const rename = useAuthStore((state) => state.rename);
  const { toast } = useToast();
  const [draft, setDraft] = useState(name);
  const [busy, setBusy] = useState(false);
  const dirty = draft.trim() !== name;

  async function save() {
    setBusy(true);
    const result = await rename(draft);
    setBusy(false);
    if (result.status === "ok") {
      toast({ title: "Name updated", description: `Saved to ${scope}.`, variant: "success" });
      return;
    }
    toast({ title: "Name not updated", description: result.error.message, variant: "error" });
  }

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <AvatarWithFallback name={name} size="lg" />
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold tracking-tight">{name}</h2>
          <p className="truncate text-2xs text-muted-foreground">{email}</p>
        </div>
      </div>

      <div className="mt-4 space-y-1.5">
        <Label htmlFor="account-name">Display name</Label>
        <div className="flex flex-wrap items-start gap-2">
          <Input
            id="account-name"
            value={draft}
            maxLength={80}
            onChange={(event) => setDraft(event.target.value)}
            className="max-w-sm"
          />
          <Button type="button" size="sm" onClick={() => void save()} disabled={!dirty || busy}>
            {busy ? <Spinner size="sm" /> : null}
            Save
          </Button>
        </div>
        <p className="text-3xs leading-relaxed text-muted-foreground">
          {backendConfigured()
            ? "The name is sent to the auth service and stored with the account. The email address is the account key and is not editable here."
            : "The name is rewritten in this browser's session only. The email address is the demo account's key and is not editable here."}
        </p>
      </div>
    </Card>
  );
}

function SubscriptionCard({ plan }: { plan: Plan }) {
  const [state, setState] = useState<SubscriptionState | null>(null);
  const [portalNote, setPortalNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void getSubscription(plan).then((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
    };
  }, [plan]);

  async function manage() {
    setBusy(true);
    setPortalNote(null);
    try {
      const outcome = await openBillingPortal();
      if (outcome.status === "redirect") {
        window.location.assign(outcome.url);
        return;
      }
      setPortalNote(`${outcome.error.message}${outcome.error.hint ? ` ${outcome.error.hint}` : ""}`);
    } catch (error) {
      setPortalNote(error instanceof Error ? error.message : "The billing service did not answer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold tracking-tight">Subscription</h2>
        {state ? (
          <Badge variant={state.status === "active" || state.status === "unsubscribed" ? "secondary" : "warning"} size="sm">
            {SUBSCRIPTION_STATUS_LABEL[state.status]}
          </Badge>
        ) : null}
      </div>

      {!state ? (
        <p className="mt-3 flex items-center gap-2 text-2xs text-muted-foreground">
          <Spinner size="sm" /> Reading the plan
        </p>
      ) : (
        <dl className="mt-3 space-y-1.5 text-2xs">
          <Row label="Plan">
            {state.planName}
            {state.price !== null ? ` · $${state.price} ${state.cycle === "annual" ? "a month, billed yearly" : "a month"}` : ""}
          </Row>
          <Row label="Billing period ends">{state.currentPeriodEnd ? formatDate(state.currentPeriodEnd) : "not on a paid period"}</Row>
          <Row label="Source">{state.source}</Row>
        </dl>
      )}

      {state ? (
        <p className="mt-2 text-3xs leading-relaxed text-muted-foreground">{state.note}</p>
      ) : null}
      {state?.cancelAtPeriodEnd ? (
        <p className="mt-2 rounded-lg border border-warning/35 bg-surface-sunken px-3 py-2 text-3xs leading-relaxed">
          This subscription is set to end at the close of the paid period. It keeps its quotas until then.
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => void manage()} disabled={busy}>
          {busy ? <Spinner size="sm" /> : <ExternalLink className="size-3.5" aria-hidden />}
          Manage billing
        </Button>
        <Button asChild size="sm" variant="ghost">
          <Link to="/pricing">Compare plans</Link>
        </Button>
      </div>
      {portalNote ? (
        <p className="mt-2 text-3xs leading-relaxed text-warning" aria-live="polite">
          {portalNote}
        </p>
      ) : null}
      <BillingNotice className="mt-3" />
    </Card>
  );
}

function SecurityCard({
  issuedAt,
  expiresAt,
  mode,
}: {
  issuedAt: string;
  expiresAt: string;
  mode: "remote" | "local-demo";
}) {
  const signOut = useAuthStore((state) => state.signOut);
  const { toast } = useToast();

  return (
    <Card className="p-4">
      <h2 className="flex items-center gap-1.5 text-xs font-semibold tracking-tight">
        <ShieldCheck className="size-3.5 text-primary" aria-hidden />
        Session
      </h2>
      <dl className="mt-3 space-y-1.5 text-2xs">
        <Row label="Signed in">{formatDateTime(issuedAt)}</Row>
        <Row label="Expires">{formatDateTime(expiresAt)}</Row>
        <Row label="Verified by">{mode === "remote" ? "the auth service" : "this browser only"}</Row>
      </dl>
      <p className="mt-2 flex items-start gap-2 rounded-lg border border-border bg-surface-sunken px-3 py-2 text-3xs leading-relaxed text-muted-foreground">
        <KeyRound className="mt-px size-3.5 shrink-0" aria-hidden />
        {mode === "remote"
          ? "Passwords are changed on the auth service. This build holds no password and cannot send a new one."
          : DEMO_SESSION_NOTICE}
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="mt-3"
        onClick={() => {
          void signOut().then(() => toast({ title: "Signed out", description: "The session was removed from this browser." }));
        }}
      >
        <LogOut className="size-3.5" aria-hidden />
        Sign out
      </Button>
    </Card>
  );
}

function DataCard({ documents, analyses }: { documents: number; analyses: number }) {
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  function clear() {
    clearAllAppData();
    setConfirming(false);
    setDone("Every vw. key this app wrote has been removed from this browser. Refresh to see an empty workspace.");
  }

  return (
    <Card className="p-4">
      <h2 className="text-xs font-semibold tracking-tight">Data in this browser</h2>
      <dl className="mt-3 space-y-1.5 text-2xs">
        <Row label="Saved documents">{documents}</Row>
        <Row label="Analyses in history">{analyses}</Row>
      </dl>
      <p className="mt-2 text-3xs leading-relaxed text-muted-foreground">
        {backendConfigured()
          ? "These counts are what this device holds. The analysis service keeps its own copy of anything it processed."
          : "No service is attached, so this device holds everything the workspace can show."}
      </p>

      {done ? (
        <p className="mt-3 rounded-lg border border-success/35 bg-surface-sunken px-3 py-2 text-3xs leading-relaxed" role="status">
          {done}
        </p>
      ) : null}

      {confirming ? (
        <div className="mt-3 space-y-2 rounded-lg border border-error/40 bg-surface-sunken p-3">
          <p className="text-3xs leading-relaxed">
            This removes documents, history, reports, drafts, citations and preferences from this
            browser. It cannot be undone, and it does not touch anything a service may hold.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="destructive" onClick={clear}>
              <Trash2 className="size-3.5" aria-hidden />
              Delete everything
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => setConfirming(true)} disabled={Boolean(done)}>
          <Trash2 className="size-3.5" aria-hidden />
          Clear this browser&rsquo;s data
        </Button>
      )}
    </Card>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
