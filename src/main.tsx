import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "@/App";
import { ToastProvider } from "@/components/ui/toast";
import { applyThemeClass, useUiStore, watchSystemTheme } from "@/store/uiStore";
import { usePreferencesStore } from "@/store/preferencesStore";
import "./styles.css";

applyThemeClass(useUiStore.getState().theme);
watchSystemTheme();

/**
 * Display density is a root font size, because the scale is rem-based throughout: one
 * number moves padding, gaps and control heights together instead of patching each.
 */
function applyDensity(density: "comfortable" | "compact") {
  document.documentElement.style.fontSize = density === "compact" ? "15px" : "16px";
}

/**
 * The in-app motion switch reaches the CSS animations and transitions that
 * usePrefersReducedMotion cannot — framer-motion reads the hook, the stylesheet
 * reads this attribute, and both honour whichever of the two asks for less.
 */
function applyReduceMotion(reduce: boolean) {
  document.documentElement.dataset.reduceMotion = reduce ? "on" : "off";
}

function applyAppearance(state: { density: "comfortable" | "compact"; reduceMotion: boolean }) {
  applyDensity(state.density);
  applyReduceMotion(state.reduceMotion);
}

const initialPreferences = usePreferencesStore.getState();
applyDensity(initialPreferences.density);
applyReduceMotion(initialPreferences.reduceMotion);
usePreferencesStore.subscribe((state, previous) => {
  if (state.density !== previous.density || state.reduceMotion !== previous.reduceMotion) {
    applyAppearance(state);
  }
});

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root container #root is missing from index.html");
}

createRoot(container).render(
  <StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
