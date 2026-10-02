import { Link } from "react-router-dom";
import { FOOTER_COLUMNS } from "@/config/navigation";
import { Logo } from "@/components/navigation/Logo";
import { Select } from "@/components/ui/select";
import { ThemeToggle } from "@/components/navigation/ThemeToggle";

const DISCLAIMER =
  "VeriWrite reports probabilistic estimates. Detection output reflects writing signals, not proof of who wrote a text.";

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-[86rem] px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <div>
            <Logo />
            <p className="mt-3 max-w-[19rem] text-[0.8125rem] leading-relaxed text-muted-foreground">
              Understand the writing behind the words. Analysis, revision and originality tools for
              people who care how a sentence reads.
            </p>
            <p className="mt-4 text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Product
            </p>
            <ul className="mt-1.5 space-y-1 text-[0.8125rem]">
              <li>
                <Link to="/pricing" className="text-muted-foreground transition-colors hover:text-foreground">
                  Pricing
                </Link>
              </li>
              <li>
                <Link to="/usage" className="text-muted-foreground transition-colors hover:text-foreground">
                  Usage limits
                </Link>
              </li>
              <li>
                <Link
                  to="/legal/responsible-ai"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  Responsible AI
                </Link>
              </li>
            </ul>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
            {FOOTER_COLUMNS.map((column) => (
              <div key={column.heading}>
                <h2 className="text-2xs font-semibold uppercase tracking-[0.08em] text-foreground">
                  {column.heading}
                </h2>
                <ul className="mt-3 space-y-2">
                  {column.links.map((link) => (
                    <li key={link.to + link.label}>
                      <Link
                        to={link.to}
                        className="text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-12 rounded-lg border border-border bg-card p-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">A note on detection results. </span>
            {DISCLAIMER}
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} VeriWrite. All rights reserved.
          </p>
          <div className="flex items-center gap-3">
            <Select aria-label="Interface language" className="h-8 w-[8.5rem] text-xs" defaultValue="en">
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="pt">Português</option>
            </Select>
            <ThemeToggle className="size-8" />
          </div>
        </div>
      </div>
    </footer>
  );
}
