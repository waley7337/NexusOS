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
 * Quick-action registry shared by the shell's Capture button and the
 * command palette. Only real actions live here: theme toggle and
 * navigation. Module create-actions join this list when those APIs exist.
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
