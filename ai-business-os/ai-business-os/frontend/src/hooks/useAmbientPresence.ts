/**
 * Ambient presence — DISABLED for frame-pacing.
 *
 * Previously wrote --alive-* CSS vars on pointer/scroll via rAF, which
 * drove large-surface transforms (atmosphere parallax / shell energy) and
 * competed with native scrolling. Kept as a no-op hook so call sites can
 * re-enable later without inventing a new API.
 *
 * Returns a ref for API compatibility; does not attach listeners.
 */
import { useRef } from "react";

export function useAmbientPresence(enabled = true) {
  void enabled;
  return useRef<HTMLDivElement>(null);
}
