/**
 * PortfolioShell — the framed NexusOS workspace the star-entry resolves
 * into.
 *
 * Markup and classes are AppLayout's (.app-stage > Atmosphere +
 * .app-shell-frame > .chassis with a real rail track), so the shell picks up
 * the product's frame, ambient light and reveal keyframe from globals.css.
 * The two DOM-only effects below are AppLayout's reveal logic, unchanged in
 * behaviour: data-reveal="cinematic" is set only when this shell mounted
 * during the cinematic, and removed once it settles.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { Atmosphere } from "@/components/atmosphere";
import { useUiStore } from "@/stores/ui";
import { NeuralBackground } from "~/animations/NeuralBackground";
import { PortfolioNav, MobileNav } from "~/components/PortfolioNav";
import { useActiveSection } from "~/components/useActiveSection";
import { SECTIONS } from "~/sections/registry";

export function PortfolioShell({ children, onReplayIntro }: { children: ReactNode; onReplayIntro: () => void }) {
  const authEntryActive = useUiStore((s) => s.isAuthEntryActive);
  const stageRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const revealFromCinematic = useRef(useUiStore.getState().isAuthEntryActive);
  const active = useActiveSection(mainRef, SECTIONS.map((s) => s.id));

  useEffect(() => {
    const el = stageRef.current;
    if (!el || !revealFromCinematic.current) return;
    if (authEntryActive) {
      el.dataset.reveal = "cinematic";
    } else {
      delete el.dataset.reveal;
      revealFromCinematic.current = false;
    }
  }, [authEntryActive]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    el.dataset.entry = "in";
    if (authEntryActive) return;
    let f2 = 0;
    const f1 = window.requestAnimationFrame(() => {
      f2 = window.requestAnimationFrame(() => {
        el.dataset.entry = "settled";
      });
    });
    return () => {
      window.cancelAnimationFrame(f1);
      window.cancelAnimationFrame(f2);
    };
  }, [authEntryActive]);

  const goTo = (id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    window.history.replaceState(null, "", `#${id}`);
  };

  return (
    <div ref={stageRef} className="app-stage h-dvh overflow-hidden text-foreground" data-testid="portfolio-shell">
      <Atmosphere />
      <div className="app-shell-frame">
        <div className="chassis h-full overflow-hidden bg-transparent">
          <PortfolioNav active={active} onNavigate={goTo} onReplayIntro={onReplayIntro} />
          <div className="chassis-rail hidden md:block" aria-hidden="true" />
          <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
            <MobileNav active={active} onNavigate={goTo} />
            <div className="relative min-h-0 flex-1">
              <NeuralBackground />
              <main ref={mainRef} id="main" className="portfolio-main relative h-full overflow-y-auto" tabIndex={-1}>
                {children}
              </main>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
