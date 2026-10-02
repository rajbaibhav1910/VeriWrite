import { useEffect, useState } from "react";
import { usePreferencesStore } from "@/store/preferencesStore";

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false,
  );

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const list = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(list.matches);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

export const useIsDesktop = () => useMediaQuery("(min-width: 1024px)");
export const useIsTablet = () => useMediaQuery("(min-width: 768px)");
/** The system setting or the in-app switch, whichever asks for less motion. */
export function usePrefersReducedMotion(): boolean {
  const system = useMediaQuery("(prefers-reduced-motion: reduce)");
  const chosen = usePreferencesStore((state) => state.reduceMotion);
  return system || chosen;
}
