import { Moon, Sun, type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PALETTE_PAGES } from "@/constants/routes";
import { useTheme } from "@/providers/theme-provider";

export interface CaptureAction {
  id: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
}

/**
 * Quick-action registry shared by the shell's "+Capture" button and the
 * command palette (Part 04, Phase 5 introduced this empty; Phase 6 gives
 * it its first real, generic entries so both surfaces read from one place
 * instead of each hardcoding its own copy). "New customer" stays palette-
 * only — it's an explicit stub, not a generic action, so it doesn't belong
 * in the permanent registry until CRM (Part 6+) registers something real.
 */
export function useCaptureActions(): CaptureAction[] {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  return [
    {
      id: "toggle-theme",
      label: "Toggle theme",
      icon: theme === "dark" ? Sun : Moon,
      onSelect: () => setTheme(theme === "dark" ? "light" : "dark"),
    },
    ...PALETTE_PAGES.map((item) => ({
      id: `go-${item.to}`,
      label: item.label,
      icon: item.icon,
      onSelect: () => navigate(item.to),
    })),
  ];
}
