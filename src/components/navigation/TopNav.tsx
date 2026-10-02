import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { ChevronDown, Menu, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Logo } from "@/components/navigation/Logo";
import { ThemeToggle } from "@/components/navigation/ThemeToggle";
import { MARKETING_MENUS, RESOURCE_LINKS, TOOLS } from "@/config/navigation";
import { UserMenu } from "@/components/auth/UserMenu";
import { useAuthSession } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";
import { cn } from "@/lib/utils";

export function TopNav() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const setCommandPaletteOpen = useUiStore((state) => state.setCommandPaletteOpen);
  const session = useAuthSession();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex min-h-[var(--header-height)] max-w-[86rem] items-center gap-1 px-4 pt-[env(safe-area-inset-top)] sm:px-6 lg:px-8">
        <Link to="/" className="mr-4 rounded-sm" aria-label="VeriWrite home">
          <Logo />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-0.5 lg:flex">
          <NavLink
            to="/detector"
            className={({ isActive }) =>
              cn(
                "rounded-md px-3 py-2 text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                isActive && "text-foreground",
              )
            }
          >
            Detector
          </NavLink>

          {MARKETING_MENUS.map((menu) => (
            <Popover key={menu.label} open={openMenu === menu.label} onOpenChange={(open) => setOpenMenu(open ? menu.label : null)}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={`${menu.label} menu`}
                  className="group flex items-center gap-1 rounded-md px-3 py-2 text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground"
                >
                  {menu.label}
                  <ChevronDown
                    className={cn(
                      "size-3.5 transition-transform duration-200",
                      openMenu === menu.label && "rotate-180",
                    )}
                    aria-hidden="true"
                  />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[42rem] p-4" collisionPadding={16}>
                <MegaMenu menu={menu} onNavigate={() => setOpenMenu(null)} />
              </PopoverContent>
            </Popover>
          ))}

          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Resources menu"
                className="flex items-center gap-1 rounded-md px-3 py-2 text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                Resources
                <ChevronDown className="size-3.5" aria-hidden="true" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-2">
              <ul className="space-y-0.5">
                {RESOURCE_LINKS.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="block rounded-md px-3 py-2 text-[0.8125rem] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="hidden text-muted-foreground sm:inline-flex"
            onClick={() => setCommandPaletteOpen(true)}
            aria-label="Search tools (Ctrl+K)"
          >
            <Search className="size-[18px]" aria-hidden="true" />
          </Button>
          <ThemeToggle />
          {session ? (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
                <Link to="/dashboard">Open app</Link>
              </Button>
              <UserMenu compact className="hidden md:flex" />
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
                <Link to="/login">Log in</Link>
              </Button>
              <Button asChild size="sm" className="hidden md:inline-flex">
                <Link to="/signup">Sign up free</Link>
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Open navigation menu"
            onClick={() => useUiStore.getState().setMobileNavOpen(true)}
          >
            <Menu className="size-5" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </header>
  );
}

function MegaMenu({
  menu,
  onNavigate,
}: {
  menu: (typeof MARKETING_MENUS)[number];
  onNavigate: () => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-1">
      {menu.columns.map((column) => (
        <div key={column.heading}>
          <p className="mb-1 px-2 text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {column.heading}
          </p>
          <ul className="space-y-0.5">
            {column.links.map((link) => {
              const Icon = link.icon;
              return (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    onClick={onNavigate}
                    className="flex items-start gap-2.5 rounded-md px-2 py-2 transition-colors hover:bg-accent"
                  >
                    {Icon && (
                      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface">
                        <Icon className="size-3.5 text-primary" aria-hidden="true" />
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block text-[0.8125rem] font-medium text-foreground">
                        {link.label}
                      </span>
                      <span className="block text-xs leading-snug text-muted-foreground">
                        {link.description}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <div className="col-span-2 mt-2 flex items-center justify-between border-t border-border pt-3">
        <p className="text-xs text-muted-foreground">
          Nine tools, one workspace. Start on the free plan.
        </p>
        <div className="flex items-center gap-1">
          {TOOLS.slice(0, 4).map((tool) => (
            <Button asChild key={tool.path} variant="subtle" size="sm" className="text-2xs">
              <Link to={tool.path} onClick={onNavigate}>
                {tool.name}
              </Link>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Mobile navigation drawer content. */
export function MobileNavContent({ onNavigate }: { onNavigate: () => void }) {
  const session = useAuthSession();
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <Logo />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close navigation menu"
          onClick={onNavigate}
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {TOOLS.map((tool) => (
            <li key={tool.path}>
              <Link
                to={tool.path}
                onClick={onNavigate}
                className="block rounded-md px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                {tool.name}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-4 border-t border-border pt-4">
          <p className="px-3 pb-1.5 text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Account
          </p>
          <ul className="space-y-0.5">
            {[
              { to: "/documents", label: "Documents" },
              { to: "/history", label: "History" },
              { to: "/reports", label: "Reports" },
              { to: "/usage", label: "Usage" },
              { to: "/pricing", label: "Pricing" },
              { to: "/settings", label: "Settings" },
              ...RESOURCE_LINKS.map((r) => ({ to: r.to, label: r.label })),
            ]
              // The resource list repeats Pricing, which would collide as a key.
              .filter((link, index, list) => list.findIndex((other) => other.to === link.to) === index)
              .map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  onClick={onNavigate}
                  className="block rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-border p-3">
        {session ? (
          <>
            <UserMenu compact onNavigate={onNavigate} className="shrink-0" />
            <Button asChild size="sm" className="flex-1">
              <Link to="/dashboard" onClick={onNavigate}>
                Open app
              </Link>
            </Button>
          </>
        ) : (
          <>
            <Button asChild variant="outline" size="sm" className="flex-1">
              <Link to="/login" onClick={onNavigate}>
                Log in
              </Link>
            </Button>
            <Button asChild size="sm" className="flex-1">
              <Link to="/signup" onClick={onNavigate}>
                Sign up
              </Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
