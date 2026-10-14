/**
 * SpatialShell — shared NexusOS dark auth atmosphere used by login and
 * billing checkout. Wakes the global SpaceField (starfield + light volumes)
 * so both routes share the exact same 3D spatial background.
 *
 * Does not own SpaceField itself — that stays mounted once in App.tsx so the
 * canvas survives route changes without reseeding.
 */
import { useEffect, type ReactNode } from "react";
import { useUiStore } from "@/stores/ui";
import { cn } from "@/lib/utils";

interface SpatialShellProps {
  children: ReactNode;
  /** Wider column for checkout composition. */
  density?: "auth" | "checkout";
  className?: string;
  /** Optional identity block above the surface (wordmark + tagline). */
  showIdentity?: boolean;
  tagline?: string;
}

export function SpatialShell({
  children,
  density = "auth",
  className,
  showIdentity = true,
  tagline = "Business operating system",
}: SpatialShellProps) {
  const immersing = useUiStore((s) => s.isAuthEntryActive);

  useEffect(() => {
    const { setSpaceStage } = useUiStore.getState();
    if (useUiStore.getState().spaceStage !== "travel") setSpaceStage("idle");
    return () => {
      if (!useUiStore.getState().isAuthEntryActive) setSpaceStage("off");
    };
  }, []);

  return (
    <div
      className={cn(
        "dark auth-shell auth-page auth-world",
        density === "checkout" && "auth-world--checkout",
        className,
      )}
      data-auth-stage={immersing ? "leaving" : "idle"}
      data-spatial-shell={density}
    >
      <div className={cn("auth-column", density === "checkout" && "auth-column--checkout")}>
        {showIdentity && (
          <div className="auth-identity">
            <img
              className="nexusos-wordmark-img"
              src="/nexusos-wordmark.png"
              alt="NexusOS"
              width={196}
              height={30}
              draggable={false}
            />
            <p className="auth-tagline">{tagline}</p>
          </div>
        )}

        <div className="auth-panel">
          <div
            className={cn("auth-surface", density === "checkout" && "auth-surface--checkout")}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
