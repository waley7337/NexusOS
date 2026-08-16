import { Suspense, useLayoutEffect, useRef, type ReactNode } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { RouteErrorBoundary } from "@/components/route-error-boundary";
import { PageLoading } from "@/components/page-loading";

/** Opacity + slight rise (~240ms) + buffer. Forces visible if animationend never fires. */
const ROUTE_ENTER_SETTLE_MS = 300;

/**
 * Authenticated content boundary. AppLayout (sidebar, top bar, status)
 * stays mounted; only this surface transitions between routes.
 *
 * Enter-only CSS (`.route-enter`) — opacity + ~6px translateY.
 * Keyed by pathname so rapid navigation replaces the previous surface
 * immediately (no animation queue). Cleanup cancels in-flight animations.
 *
 * First paint skips enter so login cinematic is not doubled.
 *
 * Suspense around `<Outlet />` must not be paired with RR's default
 * `startTransition` router updates (see `App.tsx` `useTransitions={false}`):
 * otherwise a suspending lazy page keeps the previous outlet painted while
 * the URL has already changed.
 */
export function LazyOutlet() {
  const { pathname } = useLocation();
  const skipEnter = useRef(true);

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

function RouteSurface({
  playEnter,
  children,
}: {
  playEnter: boolean;
  children: ReactNode;
}) {
  const play = useRef(playEnter);
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !play.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("route-enter-settled");
      return;
    }

    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
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
      el.getAnimations?.().forEach((animation) => {
        try {
          animation.cancel();
        } catch {
          /* already finished */
        }
      });
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
