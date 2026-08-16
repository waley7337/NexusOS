/**
 * Ambient presence — compositor-friendly.
 *
 * Writes CSS custom properties via coalesced rAF (never React state):
 *   --alive-px / --alive-py   pointer (-1…1), fine desktop only
 *   --alive-energy            0 calm → 1 after interaction
 *   --alive-scroll            0…1 main scroll progress
 *
 * Pointer is throttled; uses clientX/innerWidth (no getBoundingClientRect).
 * Energy settle uses a timeout, not a continuous rAF decay loop.
 */
import { useEffect, useRef } from "react";

const IDLE_MS = 2800;
const POINTER_MIN_MS = 32;

export function useAmbientPresence(enabled = true) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || !enabled) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      root.dataset.alive = "reduce";
      root.style.setProperty("--alive-px", "0");
      root.style.setProperty("--alive-py", "0");
      root.style.setProperty("--alive-energy", "0");
      root.style.setProperty("--alive-scroll", "0");
      return;
    }

    const finePointer = window.matchMedia("(pointer: fine) and (min-width: 1024px)");

    let px = 0;
    let py = 0;
    let energy = 0;
    let scrollP = 0;
    let frame = 0;
    let idleTimer = 0;
    let lastPointer = 0;

    const paint = () => {
      frame = 0;
      root.style.setProperty("--alive-px", px.toFixed(4));
      root.style.setProperty("--alive-py", py.toFixed(4));
      root.style.setProperty("--alive-energy", energy.toFixed(4));
      root.style.setProperty("--alive-scroll", scrollP.toFixed(4));
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(paint);
    };

    const wake = (nextEnergy = 0.55) => {
      energy = Math.min(1, Math.max(energy, nextEnergy));
      root.dataset.alive = "active";
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        energy = 0;
        root.dataset.alive = "calm";
        schedule();
      }, IDLE_MS);
      schedule();
    };

    const onPointer = (event: PointerEvent) => {
      const now = performance.now();
      if (now - lastPointer < POINTER_MIN_MS) return;
      lastPointer = now;

      if (finePointer.matches && window.innerWidth > 0 && window.innerHeight > 0) {
        px = (event.clientX / window.innerWidth) * 2 - 1;
        py = (event.clientY / window.innerHeight) * 2 - 1;
      }
      wake(0.5);
    };

    const onPointerDown = () => wake(0.65);
    const onFocusIn = () => wake(0.4);

    const main = root.querySelector("main");
    const onScroll = () => {
      if (!main) return;
      const max = Math.max(1, main.scrollHeight - main.clientHeight);
      scrollP = Math.min(1, Math.max(0, main.scrollTop / max));
      wake(0.35);
    };

    root.dataset.alive = "calm";
    schedule();

    root.addEventListener("pointermove", onPointer, { passive: true });
    root.addEventListener("pointerdown", onPointerDown, { passive: true });
    root.addEventListener("focusin", onFocusIn, { passive: true });
    main?.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.clearTimeout(idleTimer);
      root.removeEventListener("pointermove", onPointer);
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("focusin", onFocusIn);
      main?.removeEventListener("scroll", onScroll);
    };
  }, [enabled]);

  return ref;
}
