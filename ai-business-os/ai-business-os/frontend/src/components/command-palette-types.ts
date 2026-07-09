/**
 * Command palette provider registry types.
 * Feature modules register entity search providers through this contract in Parts 7+.
 */
import type { LucideIcon } from "lucide-react";

export interface CommandPaletteItem {
  id: string;
  label: string;
  value: string;
  icon: LucideIcon;
  onSelect: () => void;
}

export interface CommandPaletteProvider {
  id: string;
  group: string;
  search: (query?: string, signal?: AbortSignal) => CommandPaletteItem[];
}
