import { useNavigate } from "react-router-dom";
import { FolderOpen, Gauge, LayoutDashboard, LogOut, Settings, UserSquare2 } from "lucide-react";
import { AvatarWithFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast";
import { PLANS } from "@/config/plans";
import { cn } from "@/lib/utils";
import { useAuthSession, useAuthStore } from "@/store/authStore";

interface UserMenuProps {
  /** Collapsed rail and mobile sheets show the avatar alone. */
  compact?: boolean;
  /** Lets a sheet close itself when an item is chosen. */
  onNavigate?: () => void;
  className?: string;
}

export function UserMenu({ compact = false, onNavigate, className }: UserMenuProps) {
  const navigate = useNavigate();
  const session = useAuthSession();
  const signOut = useAuthStore((state) => state.signOut);
  const { toast } = useToast();

  if (!session) return null;
  const { user } = session;
  const planName = PLANS.find((plan) => plan.id === user.plan)?.name ?? "Free";

  const go = (to: string) => {
    onNavigate?.();
    navigate(to);
  };

  const onSignOut = async () => {
    onNavigate?.();
    await signOut();
    toast({ title: "Signed out", description: "This browser no longer holds the session." });
    navigate("/", { replace: true });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className={cn(
          "flex items-center gap-2.5 rounded-md px-2 py-2 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
          compact && "justify-center px-0",
          className,
        )}
      >
        <AvatarWithFallback size="sm" name={user.name} />
        {!compact && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold text-foreground">{user.name}</span>
            <span className="block truncate text-2xs text-muted-foreground">
              {planName} plan
              {session.mode === "local-demo" ? " · demo session" : ""}
            </span>
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align={compact ? "start" : "end"} className="w-60">
        <DropdownMenuLabel>
          <span className="block truncate text-xs font-semibold">{user.email}</span>
          <span className="mt-0.5 block text-2xs font-normal text-muted-foreground">
            {session.mode === "local-demo"
              ? "Demo session held in this browser. Nothing was verified."
              : `Signed in with the ${planName} plan.`}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => go("/dashboard")}>
          <LayoutDashboard aria-hidden="true" />
          Dashboard
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => go("/documents")}>
          <FolderOpen aria-hidden="true" />
          My documents
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => go("/history")}>
          <Gauge aria-hidden="true" />
          History and reports
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => go("/account")}>
          <UserSquare2 aria-hidden="true" />
          Account
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => go("/settings")}>
          <Settings aria-hidden="true" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onSignOut}>
          <LogOut aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
