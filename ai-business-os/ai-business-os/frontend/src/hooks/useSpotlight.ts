import { useEffect, useRef } from "react";

/**
 * Tracks the pointer across an element and writes its position to the
 * --mx / --my custom properties, which the `.spotlight` class reads to place
 * a soft radial highlight (Part 04 convergence, Commit E).
 *
 * Written straight to the node's inline style rather than through React
 * state: this fires on every pointermove, and re-rendering a card subtree at
 * that rate to move a gradient would be indefensible. `.spotlight` defaults
 * to 50%/0% so an element carrying the class without this hook still looks
 * correct — the highlight just doesn't follow the cursor.
 *
 * No reduced-motion branch: this is a hover affordance that tracks a pointer
 * the user is already moving, not self-propelled motion. It also only ever
 * runs for a pointer device, and the whole effect is opacity-gated behind
 * :hover in CSS.
 */
export function useSpotlight<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const onPointerMove = (event: PointerEvent) => {
      const rect = node.getBoundingClientRect();
      node.style.setProperty("--mx", `${((event.clientX - rect.left) / rect.width) * 100}%`);
      node.style.setProperty("--my", `${((event.clientY - rect.top) / rect.height) * 100}%`);
    };

    node.addEventListener("pointermove", onPointerMove);
    return () => node.removeEventListener("pointermove", onPointerMove);
  }, []);

  return ref;
}
