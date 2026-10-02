import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LEGAL_DOCUMENTS } from "@/data/legalContent";

export function LegalPage() {
  const { slug = "" } = useParams();
  const document = LEGAL_DOCUMENTS[slug];

  if (!document) {
    return (
      <div className="py-16">
        <EmptyState
          title="Document not found"
          description={`There is no policy page at /legal/${slug}. The full set is linked from the footer.`}
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/">Back to home</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-[46rem] px-4 py-12 sm:px-6 lg:py-16">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        VeriWrite
      </Link>

      <header className="mt-5 border-b border-border pb-6">
        <Badge variant="outline" size="xs">
          {document.kind}
        </Badge>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{document.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{document.summary}</p>
        <p className="mt-3 flex items-center gap-1.5 text-2xs text-muted-foreground">
          <CalendarDays className="size-3.5" aria-hidden="true" />
          Last updated {document.updatedOn}
        </p>
      </header>

      <nav aria-label="Sections" className="mt-6 rounded-lg border border-border bg-surface p-4">
        <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Contents
        </p>
        <ol className="mt-2 space-y-1.5 text-[0.8125rem]">
          {document.sections.map((section, index) => (
            <li key={section.heading} className="flex gap-2">
              <span className="tabular text-muted-foreground">{index + 1}.</span>
              <a
                href={`#section-${index}`}
                className="text-foreground underline-offset-4 hover:underline"
              >
                {section.heading}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {document.sections.map((section, index) => (
        <section key={section.heading} id={`section-${index}`} className="mt-9 scroll-mt-20">
          <h2 className="text-base font-semibold tracking-tight">{section.heading}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 40)} className="mt-2.5 text-sm leading-[1.75] text-muted-foreground">
              {paragraph}
            </p>
          ))}
          {section.list && (
            <ul className="mt-3 space-y-2">
              {section.list.map((item) => (
                <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
                  <span className="mt-[0.55rem] size-1 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <footer className="mt-12 border-t border-border pt-6 text-xs leading-relaxed text-muted-foreground">
        {document.footnote}
      </footer>
    </article>
  );
}
