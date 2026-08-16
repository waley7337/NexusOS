/**
 * Scroll-linked product stage — DISABLED for frame-pacing.
 *
 * Previously wrote --stage-p on scroll (getBoundingClientRect + rAF) and
 * transformed a large sticky Mission Control region, fighting native scroll.
 * Hook remains as a no-op for API compatibility.
 */
import { useRef } from "react";

export function useScrollProductStage(enabled = true) {
  void enabled;
  return useRef<HTMLDivElement>(null);
}
