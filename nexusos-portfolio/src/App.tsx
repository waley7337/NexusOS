import { useState } from "react";
import { SpaceField } from "@/components/space-field";
import { useUiStore } from "@/stores/ui";
import { StarEntry } from "~/animations/StarEntry";
import { PortfolioShell } from "~/components/PortfolioShell";
import { Portfolio } from "~/sections/Portfolio";

const ENTERED_KEY = "nexusos-portfolio:entered";

/**
 * Skip the door for returning visitors in the same tab session and for deep
 * links (#cv etc.). `?intro=1` always shows it.
 */
function shouldShowIntro(): boolean {
  if (typeof window === "undefined") return true;
  const params = new URLSearchParams(window.location.search);
  if (params.get("intro") === "1") return true;
  if (params.get("intro") === "0") return false;
  if (window.location.hash.length > 1) return false;
  try {
    return window.sessionStorage.getItem(ENTERED_KEY) !== "1";
  } catch {
    return true;
  }
}

export default function App() {
  const [phase, setPhase] = useState<"intro" | "portfolio">(() => (shouldShowIntro() ? "intro" : "portfolio"));

  const enter = () => {
    try {
      window.sessionStorage.setItem(ENTERED_KEY, "1");
    } catch {
      /* storage unavailable — the intro simply shows again next time */
    }
    setPhase("portfolio");
  };

  const replay = () => {
    if (useUiStore.getState().isAuthEntryActive) return;
    window.history.replaceState(null, "", window.location.pathname);
    setPhase("intro");
  };

  return (
    <>
      {/* Before the content in DOM order, as in NexusOS App.tsx: at rest the
          space sits behind the door; it lifts itself above the shell only
          during the cinematic. */}
      <SpaceField />
      {phase === "intro" ? (
        <StarEntry onEnter={enter} />
      ) : (
        <PortfolioShell onReplayIntro={replay}>
          <Portfolio />
        </PortfolioShell>
      )}
    </>
  );
}
