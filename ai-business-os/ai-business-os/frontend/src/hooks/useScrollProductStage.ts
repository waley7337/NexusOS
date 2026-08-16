/**
 * Scroll-linked product stage.
 *
 * Drives `--stage-p` (0→1) on a track element from the nearest scroll
 * container. Uses rAF + CSS variables — no React state on scroll.
 * Honours prefers-reduced-motion by forcing progress to 1.
 */
import { useEffect, useRef } from "react";

function findScrollParent(node: HTMLElement | null): HTMLElement | Window {
  let el: HTMLElement | null = node?.parentElement ?? null;
  while (el) {
    const style = getComputedStyle(el);
    const overflowY = style.overflowY;
    if (
      (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
      el.scrollHeight > el.clientHeight
    ) {
      return el;
    }
    el = el.parentElement;
  }
  return window;
}

export function useScrollProductStage(enabled = true) {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || !enabled) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      track.style.setProperty("--stage-p", "1");
      return;
    }

    const scroller = findScrollParent(track);
    let frame = 0;

    const update = () => {
      frame = 0;
      const rect = track.getBoundingClientRect();
      const viewH =
        scroller === window
          ? window.innerHeight
          : (scroller as HTMLElement).clientHeight;
      // Progress while the track's top travels from near-top to mid-view.
      const travel = Math.max(rect.height - viewH * 0.55, viewH * 0.35);
      const raw = (viewH * 0.12 - rect.top) / travel;
      const p = Math.min(1, Math.max(0, raw));
      track.style.setProperty("--stage-p", p.toFixed(4));
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [enabled]);

  return trackRef;
}
