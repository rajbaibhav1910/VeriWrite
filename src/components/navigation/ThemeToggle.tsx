import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUiStore } from "@/store/uiStore";
import { cn } from "@/lib/utils";
import type { ThemeMode } from "@/types";

const MODES: { value: ThemeMode; label: string; icon: typeof Sun; hint: string }[] = [
  { value: "light", label: "Light", icon: Sun, hint: "Bright editorial surfaces" },
  { value: "dark", label: "Dark", icon: Moon, hint: "Dedicated dark tokens" },
  { value: "system", label: "System", icon: Monitor, hint: "Follow the OS setting" },
];

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);
  const current = MODES.find((mode) => mode.value === theme) ?? MODES[2];
  const CurrentIcon = current.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("text-muted-foreground", className)}
          aria-label={`Theme: ${current.label}. Change theme`}
        >
          <CurrentIcon className="size-[18px]" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        {MODES.map((mode) => {
          const Icon = mode.icon;
          return (
            <DropdownMenuItem
              key={mode.value}
              onSelect={() => setTheme(mode.value)}
              className="flex-col items-start gap-0.5"
            >
              <span className="flex items-center gap-2">
                <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                {mode.label}
                {theme === mode.value && (
                  <span className="sr-only">(current theme)</span>
                )}
              </span>
              <span className="text-2xs font-normal text-muted-foreground">{mode.hint}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
