/**
 * Quietly-alive presence for the authenticated shell.
 *
 * Writes CSS custom properties on the stage element via rAF:
 *   --alive-px / --alive-py   pointer (-1…1), desktop fine pointer only
 *   --alive-energy            0 calm → 1 after interaction
 *   --alive-scroll            0…1 main scroll progress
 *
 * No React state on pointer/scroll. Respects prefers-reduced-motion.
 */
import { useEffect, useRef } from "react";

const IDLE_MS = 3200;

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
    let energyFrame = 0;

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

    const settleEnergy = () => {
      energyFrame = 0;
      if (energy <= 0.002) {
        energy = 0;
        root.dataset.alive = "calm";
        schedule();
        return;
      }
      energy *= 0.92;
      schedule();
      energyFrame = window.requestAnimationFrame(settleEnergy);
    };

    const wake = () => {
      energy = Math.min(1, Math.max(energy, 0.55));
      root.dataset.alive = "active";
      if (energyFrame) {
        window.cancelAnimationFrame(energyFrame);
        energyFrame = 0;
      }
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        energyFrame = window.requestAnimationFrame(settleEnergy);
      }, IDLE_MS);
      schedule();
    };

    const onPointer = (event: PointerEvent) => {
      if (!finePointer.matches) {
        wake();
        return;
      }
      const rect = root.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      px = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      py = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      wake();
    };

    const main = root.querySelector("main");
    const onScroll = () => {
      if (!main) return;
      const max = Math.max(1, main.scrollHeight - main.clientHeight);
      scrollP = Math.min(1, Math.max(0, main.scrollTop / max));
      wake();
    };

    root.dataset.alive = "calm";
    schedule();

    root.addEventListener("pointermove", onPointer, { passive: true });
    root.addEventListener("pointerdown", wake, { passive: true });
    root.addEventListener("focusin", wake, { passive: true });
    main?.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      if (energyFrame) window.cancelAnimationFrame(energyFrame);
      window.clearTimeout(idleTimer);
      root.removeEventListener("pointermove", onPointer);
      root.removeEventListener("pointerdown", wake);
      root.removeEventListener("focusin", wake);
      main?.removeEventListener("scroll", onScroll);
    };
  }, [enabled]);

  return ref;
}
