import { Suspense, useLayoutEffect, useRef, type ReactNode } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { RouteErrorBoundary } from "@/components/route-error-boundary";
import { PageLoading } from "@/components/page-loading";

/** Standard band (220ms) plus a short buffer. If the animation clock never
 *  advances, this is what forces the surface visible instead of leaving it
 *  at the from-keyframe. */
const ROUTE_ENTER_SETTLE_MS = 300;

/**
 * Authenticated content boundary. AppLayout (sidebar, top bar, status)
 * stays mounted; only this surface transitions between routes.
 *
 * Enter-only CSS animation (`.route-enter`), not Framer. AnimatePresence,
 * a keyed motion.div, and animation controls all left the incoming page
 * at opacity 0 under rapid clicking — Framer applied the hidden target
 * and never ran the visible animation on the replacement instance.
 * CSS `animation-fill-mode: both` always lands on the finished state
 * when the document timeline is running; `route-enter-settled` is the
 * fail-visible backstop if it is not.
 *
 * The first paint of this outlet (login landing, session restore) skips
 * the enter so Phase C cannot impersonate the locked Phase F overlay.
 * playEnter is frozen on the keyed child: AppLayout re-renders every
 * second for the clock, and toggling the class on the same node would
 * replay the enter on a landing that should stay still.
 */
export function LazyOutlet() {
  const { pathname } = useLocation();
  const skipEnter = useRef(true);

  // Inner <main> owns scroll, not the window. Resetting here prevents a new
  // page from resolving at the previous page's scroll offset — which would
  // read as a giant translated surface rather than a 8px settle.
  useLayoutEffect(() => {
    const main = document.querySelector("main");
    if (main) main.scrollTop = 0;
    skipEnter.current = false;
  }, [pathname]);

  return (
    <RouteSurface key={pathname} playEnter={!skipEnter.current}>
      <RouteErrorBoundary>
        <Suspense fallback={<PageLoading />}>
          <Outlet />
        </Suspense>
      </RouteErrorBoundary>
    </RouteSurface>
  );
}

function RouteSurface({ playEnter, children }: { playEnter: boolean; children: ReactNode }) {
  const play = useRef(playEnter);
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !play.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      el.getAnimations?.().forEach((animation) => {
        try {
          animation.finish();
        } catch {
          /* already finished or not finishable */
        }
      });
      el.classList.add("route-enter-settled");
    };

    const onEnd = (event: AnimationEvent) => {
      if (event.target !== el) return;
      settle();
    };

    el.addEventListener("animationend", onEnd);
    const id = window.setTimeout(settle, ROUTE_ENTER_SETTLE_MS);
    return () => {
      el.removeEventListener("animationend", onEnd);
      window.clearTimeout(id);
    };
  }, []);

  return (
    <div
      ref={ref}
      data-route-surface=""
      className={play.current ? "route-enter w-full" : "w-full"}
    >
      {children}
    </div>
  );
}
