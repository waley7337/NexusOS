import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** How many animation frames to wait for the route's <h1> before settling for
 *  <main>. ~30 frames is half a second at 60Hz — long enough for a lazy route
 *  chunk to resolve, short enough that focus never feels detached from the
 *  navigation that caused it. */
const MAX_FRAMES = 30;

/**
 * Moves focus to the page h1 (or main) on route change (§5.19).
 *
 * Part 04 convergence, Commit C — bug fix. Every real page's heading lives
 * inside a lazily-loaded route chunk, so when this effect ran the h1 did not
 * exist yet: the Suspense fallback was still mounted. The old implementation
 * read the DOM once and fell straight through to <main>, which meant focus
 * landed on the content container on essentially every navigation. Because
 * <main> carries tabIndex={-1}, Chromium then painted its platform focus ring
 * around the entire content region — measured as `outline: 1px auto` on a
 * focused <main>, and reported as a "harsh bright-blue outline".
 *
 * The fix is to wait for the heading rather than give up on the first frame.
 * <main> remains the fallback for a route that genuinely has no h1, so the
 * accessibility guarantee is unchanged: focus always lands inside the new
 * page's content.
 *
 * The ring itself is suppressed separately, on the two elements that receive
 * programmatic focus (<main> and PageHeader's heading). Neither is reachable
 * with Tab, so nothing a keyboard user relies on is lost — every genuinely
 * interactive control keeps its focus-visible ring.
 */
export function useRouteFocus(): void {
  const { pathname } = useLocation();

  useEffect(() => {
    let frame = 0;
    let attempts = 0;

    const focusTarget = () => {
      const main = document.querySelector("main");
      const heading = main?.querySelector("h1");

      if (heading) {
        heading.focus({ preventScroll: true });
        return;
      }

      if (attempts < MAX_FRAMES) {
        attempts += 1;
        frame = requestAnimationFrame(focusTarget);
        return;
      }

      main?.focus({ preventScroll: true });
    };

    frame = requestAnimationFrame(focusTarget);
    return () => cancelAnimationFrame(frame);
  }, [pathname]);
}
