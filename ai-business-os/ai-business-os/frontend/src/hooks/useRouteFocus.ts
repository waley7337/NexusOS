import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** Moves focus to the page h1 (or main) on route change (§5.19). */
export function useRouteFocus(): void {
  const { pathname } = useLocation();

  useEffect(() => {
    const main = document.querySelector("main");
    const heading = main?.querySelector("h1");
    const target = (heading ?? main) as HTMLElement | null;
    target?.focus({ preventScroll: true });
  }, [pathname]);
}
