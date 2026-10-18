/**
 * StarEntry — the portfolio's first room, and its stand-in for NexusOS's
 * LoginPage + AuthLayout pair.
 *
 * Nothing about the cinematic is reimplemented here. The environment is the
 * NexusOS SpaceField (mounted once in App, outside this component), the
 * timeline is lib/auth-cinematic.ts, and the trigger is the same store
 * action LoginPage calls after a successful sign-in. This component only
 * does what AuthLayout and LoginPage do around it:
 *
 *   mount     claim the space as "idle" unless a cinematic already owns it
 *   enter     armAuthEntry() → the door recedes (data-auth-stage="leaving")
 *   +380ms    swap to the portfolio — LoginPage's deferred navigate
 *   unmount   put the space away unless the cinematic owns it
 *
 * Under reduced motion the swap is immediate, as in LoginPage.
 */
import { useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CINEMATIC_CARD_EXIT_MS, prefersReducedMotion } from "@/lib/auth-cinematic";
import { useUiStore } from "@/stores/ui";
import { profile } from "~/data/profile";

export function StarEntry({ onEnter }: { onEnter: () => void }) {
  const immersing = useUiStore((s) => s.isAuthEntryActive);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const { setSpaceStage } = useUiStore.getState();
    if (useUiStore.getState().spaceStage !== "travel") setSpaceStage("idle");
    return () => {
      window.clearTimeout(timer.current);
      if (!useUiStore.getState().isAuthEntryActive) setSpaceStage("off");
    };
  }, []);

  const enter = () => {
    if (useUiStore.getState().isAuthEntryActive) return;
    useUiStore.getState().armAuthEntry();
    if (prefersReducedMotion()) {
      onEnter();
      return;
    }
    timer.current = window.setTimeout(onEnter, CINEMATIC_CARD_EXIT_MS);
  };

  return (
    <div
      className="dark auth-shell auth-page auth-world"
      data-auth-stage={immersing ? "leaving" : "idle"}
      data-testid="star-entry"
    >
      <div className="auth-column">
        <div className="auth-identity">
          <img
            className="nexusos-wordmark-img"
            src="/brand/nexusos-wordmark.png"
            alt="NexusOS"
            width={196}
            height={30}
            draggable={false}
          />
          <p className="auth-tagline">Portfolio</p>
        </div>

        <div className="auth-panel">
          <div className="auth-surface">
            <p className="eyebrow">{profile.role}</p>
            <h1 className="mt-3 text-h1">{profile.name}</h1>
            <p className="mt-1.5 text-body text-muted-foreground">{profile.focus}</p>
            <p className="mt-5 text-small leading-relaxed text-muted-foreground">{profile.pitch}</p>
            <Button className="mt-7 w-full" size="lg" onClick={enter} disabled={immersing} autoFocus>
              Enter portfolio
              <ArrowRight aria-hidden="true" />
            </Button>
          </div>
          <p className="text-machine mt-5 text-center">Built on the NexusOS design system</p>
        </div>
      </div>
    </div>
  );
}
