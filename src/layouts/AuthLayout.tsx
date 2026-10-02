import { Outlet } from "react-router-dom";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/navigation/Logo";
import { ThemeToggle } from "@/components/navigation/ThemeToggle";

const ASSURANCES = [
  "Text you analyse stays in your workspace by default.",
  "Uploads are validated for type and size before any processing.",
  "Detection output is always presented with its confidence range.",
];

export function AuthLayout() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_26rem]">
      <div className="flex flex-col px-5 py-5 sm:px-8">
        <div className="flex items-center justify-between">
          <Link to="/" aria-label="VeriWrite home">
            <Logo />
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Back to site
            </Link>
          </div>
        </div>

        <main id="main-content" className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[23rem]">
            <Outlet />
          </div>
        </main>
      </div>

      <aside className="relative hidden flex-col justify-between overflow-hidden border-l border-border bg-surface p-8 lg:flex">
        <div className="pointer-events-none absolute inset-0 grid-lines opacity-[0.35]" aria-hidden="true" />
        <div className="relative">
          <span className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-card">
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
          </span>
          <h2 className="mt-5 text-xl font-semibold leading-snug tracking-tight">
            Writing analysis you can defend.
          </h2>
          <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
            Every score comes with the signals behind it, the confidence attached to it, and a plain
            statement of what it does not prove.
          </p>
        </div>
        <ul className="relative space-y-3">
          {ASSURANCES.map((line) => (
            <li key={line} className="flex gap-2.5 text-xs leading-relaxed text-muted-foreground">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              {line}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
