import { Link } from "react-router-dom";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/navigation/Logo";
import { TOOLS } from "@/config/navigation";

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-16 text-center">
      <Logo />
      <span className="mt-10 inline-flex size-11 items-center justify-center rounded-lg border border-border bg-surface">
        <FileQuestion className="size-5 text-primary" aria-hidden="true" />
      </span>
      <p className="mt-6 font-mono text-2xs uppercase tracking-[0.14em] text-muted-foreground">
        Error 404
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">This page does not exist.</h1>
      <p className="mt-2.5 max-w-md text-sm leading-relaxed text-muted-foreground">
        The address may be mistyped, or the page was renamed. Everything below is still reachable.
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
        <Button asChild>
          <Link to="/">Back to home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/detector">Open AI Detector</Link>
        </Button>
      </div>
      <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-border pt-6">
        {TOOLS.slice(0, 6).map((tool) => (
          <li key={tool.path}>
            <Link
              to={tool.path}
              className="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              {tool.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
