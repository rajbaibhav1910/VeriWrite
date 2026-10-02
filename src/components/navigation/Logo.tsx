import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  /** Renders the wordmark next to the mark. */
  withWordmark?: boolean;
  wordmarkClassName?: string;
  size?: number;
}

/**
 * Original VeriWrite mark: a document corner with a scanning aperture, reading
 * as both a "V" and a line of text being inspected.
 */
export function Logo({ className, withWordmark = true, wordmarkClassName, size = 26 }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect width="32" height="32" rx="9" fill="var(--primary)" />
        <path
          d="M9 8.5h9.5L23 13v10.5H9V8.5Z"
          stroke="var(--primary-foreground)"
          strokeWidth="1.6"
          strokeLinejoin="round"
          opacity="0.55"
        />
        <path
          d="M12.5 15.5 16 21l3.5-5.5"
          stroke="var(--primary-foreground)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="16" cy="13" r="1.35" fill="var(--secondary)" />
      </svg>
      {withWordmark && (
        <span
          className={cn(
            "text-[1.0625rem] font-semibold tracking-tightest text-foreground",
            wordmarkClassName,
          )}
        >
          VeriWrite
        </span>
      )}
    </span>
  );
}

export function LogoMarkOnly({ size }: { size?: number }) {
  return <Logo size={size} withWordmark={false} />;
}
