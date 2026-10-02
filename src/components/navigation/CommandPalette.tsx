import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CornerDownLeft, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { SIDEBAR_ITEMS, TOOLS } from "@/config/navigation";
import { useUiStore } from "@/store/uiStore";
import { cn } from "@/lib/utils";

interface Command {
  to: string;
  label: string;
  section: string;
  hint?: string;
}

const COMMANDS: Command[] = [
  ...TOOLS.map((tool) => ({
    to: tool.path,
    label: tool.name,
    section: "Tools",
    hint: tool.tagline,
  })),
  ...SIDEBAR_ITEMS.filter(
    (item) => !TOOLS.some((tool) => tool.path === item.to),
  ).map((item) => ({ to: item.to, label: item.label, section: "Workspace" })),
  { to: "/pricing", label: "Plans and pricing", section: "Account" },
  { to: "/settings", label: "Settings", section: "Account" },
  { to: "/account", label: "Profile", section: "Account" },
  { to: "/usage", label: "Usage this month", section: "Account" },
  { to: "/legal/ai-detection-limitations", label: "Detection limitations", section: "Legal" },
  { to: "/legal/responsible-ai", label: "Responsible AI", section: "Legal" },
  { to: "/legal/privacy", label: "Privacy policy", section: "Legal" },
  { to: "/legal/terms", label: "Terms of service", section: "Legal" },
];

const sections = ["Tools", "Workspace", "Account", "Legal"] as const;

export function CommandPalette() {
  const open = useUiStore((state) => state.commandPaletteOpen);
  const setOpen = useUiStore((state) => state.setCommandPaletteOpen);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = needle
      ? COMMANDS.filter(
          (command) =>
            command.label.toLowerCase().includes(needle) ||
            (command.hint ?? "").toLowerCase().includes(needle),
        )
      : COMMANDS;
    return matches.slice(0, 24);
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      // Focus after the dialog finishes mounting its content.
      const frame = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(frame);
    }
  }, [open]);

  useEffect(() => {
    setActive((current) => Math.min(current, Math.max(0, results.length - 1)));
  }, [results.length]);

  const commit = (command: Command | undefined) => {
    if (!command) return;
    setOpen(false);
    navigate(command.to);
  };

  let lastSection: string | null = null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent size="md" className="gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Search VeriWrite</DialogTitle>
        <DialogDescription className="sr-only">
          Type to jump to a tool, document view or setting.
        </DialogDescription>

        <form
          className="flex items-center gap-2.5 border-b border-border px-4 py-3"
          onSubmit={(event) => {
            event.preventDefault();
            commit(results[active]);
          }}
        >
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((i) => Math.min(i + 1, results.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              }
            }}
            placeholder="Search tools, documents and settings…"
            aria-label="Search"
            aria-controls="command-results"
            role="combobox"
            aria-expanded
            aria-autocomplete="list"
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden shrink-0 rounded-xs border border-border bg-surface px-1.5 py-0.5 font-mono text-2xs text-muted-foreground sm:block">
            Esc
          </kbd>
        </form>

        <ul
          id="command-results"
          role="listbox"
          aria-label="Search results"
          className="max-h-[min(24rem,60vh)] overflow-y-auto p-2"
        >
          {results.length === 0 && (
            <li className="px-3 py-8 text-center text-sm text-muted-foreground">
              No matches for “{query}”.
            </li>
          )}
          {results.map((command, index) => {
            const showSection = command.section !== lastSection;
            lastSection = command.section;
            return (
              <li key={command.to + command.label} role="presentation">
                {showSection && (
                  <p
                    className={cn(
                      "px-3 pb-1 pt-3 text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground",
                      !sections.includes(command.section as (typeof sections)[number]) &&
                        "text-foreground",
                    )}
                  >
                    {command.section}
                  </p>
                )}
                <button
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => commit(command)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors",
                    index === active ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {command.label}
                    </span>
                    {command.hint && (
                      <span className="block truncate text-xs">{command.hint}</span>
                    )}
                  </span>
                  {index === active && (
                    <CornerDownLeft className="size-3.5 shrink-0" aria-hidden="true" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
