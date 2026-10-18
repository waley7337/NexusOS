import { useEffect, useState, type RefObject } from "react";

/** Scroll-spy over the shell's own scroll container (not the window). */
export function useActiveSection(rootRef: RefObject<HTMLElement | null>, ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  const key = ids.join("|");

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const visible = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) visible.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
        const best = ids.find((id) => (visible.get(id) ?? 0) > 0);
        if (best) setActive(best);
      },
      { root, rootMargin: "-10% 0px -55% 0px", threshold: [0, 0.01, 0.25] },
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootRef, key]);

  return active;
}
