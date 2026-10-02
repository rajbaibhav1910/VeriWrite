import { create } from "zustand";
import type { ThemeMode } from "@/types";
import { STORAGE_KEYS, readRaw, readJson, writeJson, writeRaw } from "@/lib/storage";

const THEME_KEY = STORAGE_KEYS.theme;
const SIDEBAR_KEY = STORAGE_KEYS.sidebar;

function storedTheme(): ThemeMode {
  const raw = readRaw(THEME_KEY);
  return raw === "light" || raw === "dark" || raw === "system" ? raw : "system";
}

function systemIsDark() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

export function isDarkFor(mode: ThemeMode) {
  return mode === "dark" || (mode === "system" && systemIsDark());
}

function applyThemeClass(mode: ThemeMode) {
  document.documentElement.classList.toggle("dark", isDarkFor(mode));
}

interface UiState {
  theme: ThemeMode;
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  commandPaletteOpen: boolean;
  setTheme: (mode: ThemeMode) => void;
  cycleTheme: () => void;
  toggleSidebar: () => void;
  setMobileNavOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  theme: storedTheme(),
  sidebarCollapsed: readJson<boolean>(SIDEBAR_KEY, false),
  mobileNavOpen: false,
  commandPaletteOpen: false,

  setTheme: (theme) => {
    // Written as a raw string: the pre-paint script in index.html reads it directly.
    writeRaw(THEME_KEY, theme);
    applyThemeClass(theme);
    set({ theme });
  },

  cycleTheme: () => {
    const order: ThemeMode[] = ["light", "dark", "system"];
    const next = order[(order.indexOf(get().theme) + 1) % order.length];
    get().setTheme(next);
  },

  toggleSidebar: () => {
    const next = !get().sidebarCollapsed;
    writeJson(SIDEBAR_KEY, next);
    set({ sidebarCollapsed: next });
  },

  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
}));

/** Keeps `system` honest when the OS theme changes mid-session. */
export function watchSystemTheme() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if (useUiStore.getState().theme === "system") {
      applyThemeClass("system");
    }
  };
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export { applyThemeClass };
