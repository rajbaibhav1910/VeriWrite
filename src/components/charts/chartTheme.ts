import { useEffect, useState } from "react";

/**
 * Recharts puts colours into SVG `fill` attributes, and a CSS variable written into
 * an attribute is not resolved by every browser. Each token is therefore read back
 * as a concrete colour once, through a probe element, so the charts use the same
 * palette the rest of the interface does and follow the theme when it changes.
 */
const TOKENS = {
  ai: "--signal-ai",
  human: "--signal-human",
  mixed: "--signal-mixed",
  neutral: "--signal-neutral",
  grid: "--border",
  axis: "--muted-foreground",
  surface: "--surface-sunken",
  text: "--foreground",
  primary: "--primary",
} as const;

export type ChartToken = keyof typeof TOKENS;

export type ChartPalette = Record<ChartToken, string>;

const FALLBACK: ChartPalette = {
  ai: "oklch(0.63 0.14 65)",
  human: "oklch(0.58 0.11 165)",
  mixed: "oklch(0.55 0.12 305)",
  neutral: "oklch(0.6 0.01 265)",
  grid: "oklch(0.9 0.01 265)",
  axis: "oklch(0.5 0.01 265)",
  surface: "oklch(0.97 0.005 265)",
  text: "oklch(0.25 0.01 265)",
  primary: "oklch(0.5 0.13 265)",
};

function resolve(name: string, fallback: string): string {
  if (typeof window === "undefined" || typeof document === "undefined") return fallback;
  const probe = document.createElement("span");
  probe.style.color = `var(${name})`;
  probe.style.position = "absolute";
  probe.style.opacity = "0";
  document.body.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  return computed && computed !== "rgba(0, 0, 0, 0)" ? computed : fallback;
}

function readPalette(): ChartPalette {
  const out = {} as ChartPalette;
  for (const key of Object.keys(TOKENS) as ChartToken[]) {
    out[key] = resolve(TOKENS[key], FALLBACK[key]);
  }
  return out;
}

/** The palette the charts draw with, kept in step with the theme attributes. */
export function useChartPalette(): ChartPalette {
  const [palette, setPalette] = useState<ChartPalette>(() =>
    typeof document === "undefined" ? FALLBACK : readPalette(),
  );

  useEffect(() => {
    setPalette(readPalette());
    // Dark mode and any future theme switch land as an attribute on <html>.
    const observer = new MutationObserver(() => setPalette(readPalette()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"],
    });
    return () => observer.disconnect();
  }, []);

  return palette;
}
