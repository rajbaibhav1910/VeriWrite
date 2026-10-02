import { FileUp, Lock, ServerCog, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { backendConfigured } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/storage";
import { usePreferencesStore } from "@/store/preferencesStore";
import { Reveal, Section } from "./Section";

const FACTS = [
  {
    icon: Lock,
    title: "Analysis happens where the text already is",
    body:
      "There is no third-party call in the request path. When a deployment sets no API base URL, every detector and writing pass runs in this browser tab against the local engine, and the text never leaves the device.",
  },
  {
    icon: ShieldCheck,
    title: "Local storage is namespaced and auditable",
    body:
      "Everything persisted on the client sits under a single vw. key prefix, so clearing your data means clearing exactly these keys and nothing else. If storage is unavailable — private mode, quota full — the app falls back to memory instead of failing.",
  },
  {
    icon: FileUp,
    title: "Uploads are validated before they are parsed",
    body:
      "Documents are accepted by declared type and by size: TXT, DOCX and PDF, with anything else refused at the door rather than partially read. Word count is checked too, so an oversized file returns a specific error instead of a truncated result.",
  },
  {
    icon: ServerCog,
    title: "No secrets live in the frontend",
    body:
      "The browser only ever reads one configuration value, VITE_API_BASE_URL, and sends it as a base path. Model credentials, provider keys and corpus access belong to the server; sessions travel as HttpOnly cookies, not as tokens in script-readable storage.",
  },
];

const BACKEND_READY = [
  "Per-user rate limiting, surfaced in the UI as a plan limit rather than an unexplained failure",
  "Input normalisation and sanitisation applied before any engine or parser sees the text",
  "Timeouts and cancellation handled at the request boundary so a stuck run never hangs the editor",
  "Server-side storage decisions inherited from the same privacy toggles shown here",
];

const STORAGE_KEY_LIST = Object.values(STORAGE_KEYS);

export function SecurityPrivacy() {
  const storeDocuments = usePreferencesStore((s) => s.privacy.storeDocuments);
  const improveModels = usePreferencesStore((s) => s.privacy.improveModels);
  const updatePrivacy = usePreferencesStore((s) => s.updatePrivacy);

  return (
    <Section
      id="security"
      tone="sunken"
      eyebrow="Security & privacy"
      title="How your text is handled, stated as architecture"
      description="Not a compliance badge wall. These are the mechanics of this build, plus the two settings that decide what is kept on your device."
      align="split"
    >
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0">
          <ul className="grid gap-8 sm:grid-cols-2">
            {FACTS.map((fact, index) => (
              <li key={fact.title} className="h-full">
                <Reveal delay={index * 0.02} className="flex h-full gap-4 border-t border-border pt-5">
                  <span
                    aria-hidden
                    className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-card text-primary shadow-card"
                  >
                    <fact.icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold tracking-tight">{fact.title}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{fact.body}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>

          <div className="mt-10 rounded-lg border border-border bg-card p-6 shadow-card">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-sm font-semibold tracking-tight">
                Ready for a backend, described honestly
              </h3>
              <Badge variant="outline" size="xs">
                {backendConfigured() ? "API base URL configured" : "Running fully client-side here"}
              </Badge>
            </div>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">
              The request layer is written for a service even when none is attached. These controls are
              part of that contract, and they activate with the backend rather than being promised
              forever.
            </p>
            <ul className="mt-4 divide-y divide-border border-y border-border">
              {BACKEND_READY.map((item) => (
                <li key={item} className="flex items-start gap-3 py-3 text-xs leading-relaxed">
                  <span aria-hidden className="mt-[0.5rem] size-1 shrink-0 rounded-full bg-primary" />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <aside aria-label="Privacy settings on this device" className="min-w-0">
          <Reveal className="rounded-lg border border-border bg-card p-5 shadow-card">
            <h3 className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <SlidersHorizontal aria-hidden className="size-3.5" />
              Your settings, live
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              These switches are the real product preferences. Changing one writes it to this device
              immediately.
            </p>

            <div className="mt-4 space-y-4 border-t border-border pt-4">
              <div>
                <Switch
                  checked={storeDocuments}
                  onCheckedChange={(checked) => updatePrivacy({ storeDocuments: checked })}
                  label="Save documents locally"
                  aria-describedby="security-store-documents"
                />
                <p id="security-store-documents" className="mt-1.5 text-2xs leading-relaxed text-muted-foreground">
                  Keep text, folders and history in this browser. Turn it off and analyses still run —
                  nothing is written to storage afterwards.
                </p>
              </div>
              <div>
                <Switch
                  checked={improveModels}
                  onCheckedChange={(checked) => updatePrivacy({ improveModels: checked })}
                  label="Help improve the models"
                  aria-describedby="security-improve-models"
                />
                <p id="security-improve-models" className="mt-1.5 text-2xs leading-relaxed text-muted-foreground">
                  Off by default. Opting in would allow passages to be reviewed for engine tuning; it
                  never unlocks a bigger score.
                </p>
              </div>
            </div>

            <p className="mt-4 text-2xs">
              <Link
                to="/settings"
                className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-primary"
              >
                Manage all preferences
              </Link>{" "}
              in your account.
            </p>
          </Reveal>

          <Reveal className="mt-5 rounded-lg border border-border bg-card p-5 shadow-card" delay={0.04}>
            <h3 className="text-2xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Keys this app can write
            </h3>
            <ul className="mt-3 space-y-1">
              {STORAGE_KEY_LIST.map((key) => (
                <li key={key} className="font-mono text-2xs text-muted-foreground">
                  {key}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-2xs leading-relaxed text-muted-foreground">
              Clear them from your browser's site data and VeriWrite forgets everything it kept.
            </p>
          </Reveal>

          <p className="mt-5 space-y-2 text-xs leading-relaxed text-muted-foreground">
            <Link
              to="/legal/privacy"
              className="mr-3 font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-primary"
            >
              Privacy policy
            </Link>
            <Link
              to="/legal/responsible-ai"
              className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-primary"
            >
              Responsible AI
            </Link>
          </p>
        </aside>
      </div>
    </Section>
  );
}
