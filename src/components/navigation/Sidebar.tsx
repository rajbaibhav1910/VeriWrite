import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { PanelLeftClose, Sparkles, ArrowUpRight, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Logo } from "@/components/navigation/Logo";
import { UserMenu } from "@/components/auth/UserMenu";
import { SIDEBAR_GROUPS } from "@/config/navigation";
import { useIsSignedIn } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";
import { cn } from "@/lib/utils";

/** Kept in sync with --sidebar-width / --sidebar-width-collapsed in styles.css. */
const EXPANDED_WIDTH = "15.5rem";
const COLLAPSED_WIDTH = "4.25rem";

interface SidebarProps {
  collapsed?: boolean;
  /** The mobile drawer reuses the list without collapse affordances. */
  variant?: "fixed" | "overlay";
  onNavigate?: () => void;
}

export function Sidebar({ collapsed = false, variant = "fixed", onNavigate }: SidebarProps) {
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const isOverlay = variant === "overlay";
  const compact = isOverlay ? false : collapsed;

  return (
    <div
      className="flex h-full flex-col bg-surface"
      style={{ width: compact ? COLLAPSED_WIDTH : EXPANDED_WIDTH }}
    >
      <div
        className={cn(
          "flex h-[var(--header-height)] shrink-0 items-center border-b border-border",
          compact ? "justify-center px-2" : "justify-between px-4",
        )}
      >
        <NavLink
          to="/dashboard"
          onClick={onNavigate}
          aria-label="VeriWrite home"
          className="rounded-sm"
        >
          {compact ? (
            <Logo withWordmark={false} />
          ) : (
            <Logo wordmarkClassName="text-[0.9375rem]" />
          )}
        </NavLink>
        {!isOverlay && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleSidebar}
            aria-label={compact ? "Expand sidebar" : "Collapse sidebar"}
            className="text-muted-foreground"
          >
            <PanelLeftClose
              className={cn("size-4 transition-transform", compact && "rotate-180")}
              aria-hidden="true"
            />
          </Button>
        )}
      </div>

      <nav
        aria-label="Application sections"
        className="flex-1 overflow-y-auto overscroll-contain px-2.5 py-4"
      >
        {SIDEBAR_GROUPS.map((group, groupIndex) => (
          <div
            key={group.id}
            className={cn(groupIndex > 0 && "mt-5", compact && "mt-6 first:mt-0")}
          >
            {!compact && (
              <p className="mb-1.5 px-2.5 text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const link = (
                  <NavLink
                    to={item.to}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        "group relative flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[0.8125rem] font-medium text-muted-foreground transition-colors",
                        "hover:bg-accent hover:text-accent-foreground",
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                        isActive && "bg-primary-soft text-primary",
                        compact && "justify-center px-0",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && !compact && (
                          <span
                            aria-hidden="true"
                            className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r-full bg-primary"
                          />
                        )}
                        {Icon && <Icon className="size-[17px] shrink-0" aria-hidden="true" />}
                        {!compact && <span className="truncate">{item.label}</span>}
                      </>
                    )}
                  </NavLink>
                );

                return (
                  <li key={item.to}>
                    {compact ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right">{item.label}</TooltipContent>
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </li>
                );
              })}
            </ul>
            {!compact && groupIndex === 2 && <Separator className="mt-5" />}
          </div>
        ))}
      </nav>

      <div className={cn("shrink-0 border-t border-border p-2.5", compact && "px-2")}>
        {!compact ? (
          <div className="rounded-lg border border-border bg-card p-3 shadow-card">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
              VeriWrite Pro
            </p>
            <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">
              Advanced analysis, unlimited history and exportable reports.
            </p>
            <Button asChild size="sm" className="mt-2.5 w-full">
              <NavLink to="/pricing" onClick={onNavigate}>
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
                Upgrade plan
              </NavLink>
            </Button>
          </div>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild variant="subtle" size="icon" className="mx-auto">
                <NavLink to="/pricing" onClick={onNavigate} aria-label="Upgrade plan">
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </NavLink>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Upgrade to Pro</TooltipContent>
          </Tooltip>
        )}

        <AccountArea compact={compact} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

function AccountArea({ compact, onNavigate }: { compact: boolean; onNavigate?: () => void }) {
  const signedIn = useIsSignedIn();

  if (signedIn) {
    return (
      <div className="mt-1.5">
        <UserMenu compact={compact} onNavigate={onNavigate} />
      </div>
    );
  }

  const link = (
    <NavLink
      to="/login"
      onClick={onNavigate}
      className={cn(
        "mt-1.5 flex items-center gap-2.5 rounded-md px-2 py-2 text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
        compact ? "justify-center px-0" : "w-full",
      )}
    >
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full border border-dashed border-border",
          compact ? "" : "bg-card",
        )}
        aria-hidden="true"
      >
        <LogIn className="size-3.5" />
      </span>
      {!compact && (
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-foreground">Not signed in</span>
          <span className="block truncate text-2xs">Sign in to keep documents and history</span>
        </span>
      )}
    </NavLink>
  );

  if (!compact) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">Sign in</TooltipContent>
    </Tooltip>
  );
}

/** Animated width used by the fixed shell; kept in sync with styles.css tokens. */
export function SidebarPanel(props: SidebarProps) {
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const compact = props.collapsed ?? collapsed;
  return (
    <motion.aside
      initial={false}
      animate={{ width: compact ? COLLAPSED_WIDTH : EXPANDED_WIDTH }}
      transition={{ type: "spring", stiffness: 320, damping: 34, mass: 0.7 }}
      className="sticky top-0 hidden h-screen shrink-0 overflow-hidden border-r border-border lg:block print:hidden"
      aria-label="Primary navigation"
    >
      <Sidebar {...props} collapsed={compact} />
    </motion.aside>
  );
}
