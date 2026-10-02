import { useEffect, useRef } from "react";

export interface ShortcutHandlers {
  /** Ctrl/Cmd + Enter */
  onAnalyze?: () => void;
  /** Ctrl/Cmd + K */
  onSearch?: () => void;
  /** Ctrl/Cmd + S */
  onSave?: () => void;
  /** Escape */
  onEscape?: () => void;
  enabled?: boolean;
}

const isTypingTarget = (node: EventTarget | null) => {
  if (!(node instanceof HTMLElement)) return false;
  if (node.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(node.tagName);
};

/**
 * Global shortcuts from spec section 35.
 * Save and Escape stay live inside editors; analyze/search are intentionally
 * suppressed while typing so Ctrl+S in a textarea is not swallowed by the shell.
 */
export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    if (handlers.enabled === false) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      const active = ref.current;

      if (event.key === "Escape") {
        active.onEscape?.();
        return;
      }
      if (!meta) return;

      const key = event.key.toLowerCase();
      if (key === "enter") {
        if (isTypingTarget(event.target) && active.onAnalyze) {
          event.preventDefault();
          active.onAnalyze();
        }
        return;
      }
      if (isTypingTarget(event.target)) return;

      if (key === "k") {
        event.preventDefault();
        active.onSearch?.();
      } else if (key === "s") {
        event.preventDefault();
        active.onSave?.();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handlers.enabled]);
}
