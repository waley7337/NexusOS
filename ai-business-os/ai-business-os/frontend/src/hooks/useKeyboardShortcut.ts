import { useEffect, useRef } from "react";

export interface KeyboardShortcutOptions {
  enabled?: boolean;
  preventDefault?: boolean;
}

export interface KeyboardShortcut {
  key: string;
  meta?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
}

function matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
  const key = shortcut.key.toLowerCase();
  const eventKey = event.key.toLowerCase();
  if (eventKey !== key) return false;
  if (Boolean(shortcut.meta) !== event.metaKey) return false;
  if (Boolean(shortcut.ctrl) !== event.ctrlKey) return false;
  if (Boolean(shortcut.shift) !== event.shiftKey) return false;
  if (Boolean(shortcut.alt) !== event.altKey) return false;
  return true;
}

/** Registers a global keydown shortcut. Cleans up on unmount. */
export function useKeyboardShortcut(
  shortcut: KeyboardShortcut,
  handler: (event: KeyboardEvent) => void,
  options: KeyboardShortcutOptions = {},
): void {
  const { enabled = true, preventDefault = true } = options;
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (!matchesShortcut(event, shortcut)) return;
      if (preventDefault) event.preventDefault();
      handlerRef.current(event);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shortcut, enabled, preventDefault]);
}
