import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { CircleOff, Info, Keyboard } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { backendConfigured } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/storage";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { useUiStore } from "@/store/uiStore";
import { usePreferencesStore } from "@/store/preferencesStore";
import type { LanguageCode, ThemeMode, UserPreferences } from "@/types";

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

const DENSITY_OPTIONS: { value: UserPreferences["density"]; label: string }[] = [
  { value: "comfortable", label: "Comfortable" },
  { value: "compact", label: "Compact" },
];

/** The codes the detection and writing engines accept, in the interface's own words. */
const DOCUMENT_LANGUAGES: { code: LanguageCode; label: string }[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "pt", label: "Português" },
  { code: "it", label: "Italiano" },
  { code: "nl", label: "Nederlands" },
  { code: "zh", label: "中文" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "ru", label: "Русский" },
  { code: "ar", label: "العربية" },
  { code: "hi", label: "हिन्दी" },
];

/**
 * Preferences, all of them real: each switch here is the same value some component reads,
 * and the controls no build can honour are shown disabled with the reason, not faked.
 */
export function SettingsPage() {
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);
  const preferences = usePreferencesStore();
  const { toast } = useToast();
  const systemReducedMotion = usePrefersReducedMotion();
  const attached = backendConfigured();

  function saved(message: string) {
    toast({ title: "Preference saved", description: message, variant: "success" });
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="How the interface looks, how much of a result it shows, and what it keeps on this device."
        crumbs={[{ to: "/dashboard", label: "Workspace" }, { label: "Settings" }]}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              preferences.reset();
              saved("Every preference is back to its default. Stored documents and history were not touched.");
            }}
          >
            <CircleOff className="size-3.5" aria-hidden />
            Reset to defaults
          </Button>
        }
      />

      <div className="grid gap-4 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-3">
          <SettingGroup title="Appearance">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Label htmlFor="settings-theme">Theme</Label>
              <div id="settings-theme">
                <SegmentedControl
                  label="Theme"
                  size="sm"
                  options={THEME_OPTIONS}
                  value={theme}
                  onChange={(next) => {
                    setTheme(next);
                    saved(next === "system" ? "The theme now follows your system setting." : `Using the ${next} palette.`);
                  }}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Label htmlFor="settings-density">Display density</Label>
              <div id="settings-density">
                <SegmentedControl
                  label="Display density"
                  size="sm"
                  options={DENSITY_OPTIONS}
                  value={preferences.density}
                  onChange={(next) => {
                    preferences.update({ density: next });
                    saved(next === "compact" ? "Text and spacing are tighter." : "Back to comfortable spacing.");
                  }}
                />
              </div>
            </div>
            <p className="text-3xs leading-relaxed text-muted-foreground">
              Density changes the root text size that the whole rem-based scale is measured from, so
              padding and control heights move with it.
            </p>

            <SwitchRow
              label="Reduce motion"
              checked={preferences.reduceMotion}
              onChange={(next) => {
                preferences.update({ reduceMotion: next });
                saved(next ? "Transitions and animated text are off." : "Transitions are back on.");
              }}
              note={
                systemReducedMotion
                  ? "Your system already asks for reduced motion, so animation stays off regardless of this switch."
                  : "Turns off page transitions, the animated hero and the counting-up figures."
              }
            />
          </SettingGroup>

          <SettingGroup title="What a result shows">
            <SwitchRow
              label="Confidence on each score"
              checked={preferences.showConfidence}
              onChange={(next) => preferences.update({ showConfidence: next })}
              note="Prints how strong the evidence behind a sentence score is, next to the score."
            />
            <SwitchRow
              label="Signal explanations"
              checked={preferences.showExplanations}
              onChange={(next) => preferences.update({ showExplanations: next })}
              note="The cards that name the features a score came from. With this off the inspector shows the number and nothing else."
            />
            <SwitchRow
              label="Sentence scores in the text"
              checked={preferences.showSentenceScores}
              onChange={(next) => preferences.update({ showSentenceScores: next })}
              note="Writes each score into the margin of the analysed document, not just the panel beside it."
            />
            <p className="text-3xs leading-relaxed text-muted-foreground">
              These are the same three switches in the detector&rsquo;s result panel, and the choice
              is remembered between runs.{" "}
              <Link to="/detector" className="underline underline-offset-2">
                Open the detector
              </Link>
            </p>
          </SettingGroup>

          <SettingGroup title="Storage and privacy">
            <SwitchRow
              label="Keep my documents and analyses on this device"
              checked={preferences.privacy.storeDocuments}
              onChange={(next) => {
                preferences.updatePrivacy({ storeDocuments: next });
                saved(
                  next
                    ? "Drafts, documents and history are being saved again."
                    : "Nothing new is written to the library or the drafts. Text already stored stays until you clear it.",
                );
              }}
              note="Off means the tools stop autosaving and the library stops recording runs. Detection itself still works."
            />
            <SwitchRow
              label="Let my text contribute to model improvement"
              checked={preferences.privacy.improveModels}
              onChange={(next) => preferences.updatePrivacy({ improveModels: next })}
              disabled={!attached}
              note={
                attached
                  ? "Sent with each analysis request; the service decides what it can use."
                  : "There is no model here to improve and no service to send anything to, so this choice cannot take effect yet."
              }
            />
            <p className="text-3xs leading-relaxed text-muted-foreground">
              Everything this app stores on the device sits under <code className="font-mono text-3xs">vw.</code>{" "}
              keys in this browser.{" "}
              <Link to="/account" className="underline underline-offset-2">
                Review and clear them from the Account page
              </Link>
              . The{" "}
              <Link to="/legal/privacy" className="underline underline-offset-2">
                privacy notice
              </Link>{" "}
              says what leaves the browser in a request.
            </p>
          </SettingGroup>

          <SettingGroup title="Notifications">
            {(
              [
                ["productUpdates", "Product updates"],
                ["usageAlerts", "A warning before a monthly limit runs out"],
                ["weeklySummary", "A weekly summary of what you analysed"],
              ] as const
            ).map(([key, label]) => (
              <SwitchRow
                key={key}
                label={label}
                checked={preferences.notifications[key]}
                disabled={!attached}
                onChange={(next) =>
                  preferences.updateNotifications({ [key]: next } as Partial<UserPreferences["notifications"]>)}
                note={
                  attached
                    ? "Delivered by the notification service."
                    : "Recorded on this device. Nothing sends an email or a push yet: that needs a service with a way to reach you."
                }
              />
            ))}
          </SettingGroup>
        </div>

        <div className="space-y-3">
          <Card className="p-4">
            <h2 className="text-xs font-semibold tracking-tight">Default document language</h2>
            <p className="mt-1 text-3xs leading-relaxed text-muted-foreground">
              What the writing assistant and the translator start with. Each tool can still be
              pointed at another language per run, and detection reads the text in front of it.
            </p>
            <Select
              className="mt-2"
              aria-label="Default document language"
              value={preferences.language}
              onChange={(event) =>
                preferences.update({ language: event.target.value as LanguageCode })
              }
            >
              {DOCUMENT_LANGUAGES.map((entry) => (
                <option key={entry.code} value={entry.code}>
                  {entry.label}
                </option>
              ))}
            </Select>
          </Card>

          <Card className="p-4">
            <h2 className="flex items-center gap-1.5 text-xs font-semibold tracking-tight">
              <Keyboard className="size-3.5 text-primary" aria-hidden />
              Keyboard
            </h2>
            <dl className="mt-2 space-y-1.5 text-2xs">
              <Shortcut keys="Ctrl / Cmd + K" action="Open search" />
              <Shortcut keys="Ctrl / Cmd + Enter" action="Run the tool on screen" />
              <Shortcut keys="Esc" action="Close a panel or clear a highlight" />
            </dl>
          </Card>

          <p className="flex items-start gap-2 rounded-lg border border-border bg-surface-sunken px-3 py-2.5 text-3xs leading-relaxed text-muted-foreground">
            <Info className="mt-px size-3.5 shrink-0" aria-hidden />
            <span>
              Preferences are stored in this browser under{" "}
              <code className="font-mono text-3xs">{STORAGE_KEYS.preferences}</code>. They are not
              attached to requests, and they do not sync between devices until an account service
              holds them.
            </span>
          </p>
        </div>
      </div>
    </>
  );
}

function SettingGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="p-4">
      <h2 className="text-xs font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </Card>
  );
}

function SwitchRow({
  label,
  note,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  note: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-2xs font-medium">{label}</p>
        <p className="mt-0.5 text-3xs leading-relaxed text-muted-foreground">{note}</p>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        aria-label={label}
        size="sm"
      />
    </div>
  );
}

function Shortcut({ keys, action }: { keys: string; action: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted-foreground">{action}</dt>
      <dd>
        <kbd className="rounded border border-border bg-surface-sunken px-1.5 py-0.5 font-mono text-3xs">
          {keys}
        </kbd>
      </dd>
    </div>
  );
}
