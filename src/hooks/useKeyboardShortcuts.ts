import { useEffect } from "react";

interface Handlers {
  onNewTask?: () => void;
  onEndDay?: () => void;
  onToggleActive?: () => void;
}

const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);

function isTypingTarget(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}

export function useKeyboardShortcuts(handlers: Handlers) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = isMac ? e.metaKey : e.ctrlKey;

      // ⌘/Ctrl+N — quick add
      if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        handlers.onNewTask?.();
        return;
      }
      // ⌘/Ctrl+E — end day
      if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        handlers.onEndDay?.();
        return;
      }
      // SPACE — start/stop active task (only when not typing)
      if (e.code === "Space" && !mod && !isTypingTarget(e.target)) {
        e.preventDefault();
        handlers.onToggleActive?.();
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlers.onNewTask, handlers.onEndDay, handlers.onToggleActive]);
}
