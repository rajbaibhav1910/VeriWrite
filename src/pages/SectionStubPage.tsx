import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";

interface SectionStubPageProps {
  title: string;
  description: string;
  icon: LucideIcon;
  emptyTitle: string;
  emptyBody: string;
  /** Honest note about which phase populates the page. */
  phaseNote?: string;
  action?: ReactNode;
}

export function SectionStubPage({
  title,
  description,
  icon,
  emptyTitle,
  emptyBody,
  phaseNote,
  action,
}: SectionStubPageProps) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <div className="p-4 sm:p-6">
        <Card className="p-6">
          <EmptyState
            icon={icon}
            title={emptyTitle}
            description={phaseNote ? `${emptyBody} ${phaseNote}` : emptyBody}
            action={action}
          />
        </Card>
      </div>
    </>
  );
}
