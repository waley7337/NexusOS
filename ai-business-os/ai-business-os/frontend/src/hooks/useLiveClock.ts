/**
 * Ticking clock — single shared interval for the whole app.
 *
 * Multiple components may subscribe; only one setInterval runs.
 * Prefer calling this from small leaf components (status bar clock,
 * dashboard time) so the shell/page tree is not re-rendered every second.
 */
import { useSyncExternalStore } from "react";

let current = new Date();
const listeners = new Set<() => void>();
let intervalId: ReturnType<typeof setInterval> | null = null;

function emit() {
  current = new Date();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (intervalId === null) {
    intervalId = setInterval(emit, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

function getSnapshot(): Date {
  return current;
}

/** Server/hydration snapshot — stable Date instance for SSR safety. */
const serverSnapshot = new Date(0);

export function useLiveClock(): Date {
  return useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);
}
