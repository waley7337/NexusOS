import type { LucideIcon } from "lucide-react";

export interface CaptureAction {
  id: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
}

/**
 * Quick-action registry for the shell's "+Capture" button (Part 04, Phase
 * 5). Starts empty — Part 6+ modules register their own create actions
 * here (new contact, new task, new invoice, ...) without AppLayout
 * changing again. Shape mirrors CommandPaletteProvider's registration
 * contract (command-palette-types.ts) so the two "quick action" surfaces
 * stay consistent with each other.
 */
export function useCaptureActions(): CaptureAction[] {
  return [];
}
