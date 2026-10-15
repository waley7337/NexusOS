/**
 * Stripe Appearance API tokens mapped to NexusOS dark auth-shell variables.
 * Card fields stay inside Stripe Elements — this only themes chrome.
 */
import type { Appearance } from "@stripe/stripe-js";

function tokenSource(): Element {
  return (
    document.querySelector(".auth-shell") ??
    document.documentElement
  );
}

function cssHsl(token: string, alpha?: number): string {
  if (typeof window === "undefined") {
    return alpha === undefined ? "hsl(210 40% 96%)" : `hsl(210 40% 96% / ${alpha})`;
  }
  const raw = getComputedStyle(tokenSource()).getPropertyValue(token).trim();
  if (!raw) {
    return alpha === undefined ? "hsl(210 40% 96%)" : `hsl(210 40% 96% / ${alpha})`;
  }
  return alpha === undefined ? `hsl(${raw})` : `hsl(${raw} / ${alpha})`;
}

/** Build Appearance for Elements checkout while SpatialShell (dark.auth-shell) is mounted. */
export function nexusStripeAppearance(): Appearance {
  const hsl = cssHsl;
  return {
    theme: "night",
    variables: {
      colorPrimary: hsl("--primary-fill"),
      colorBackground: hsl("--surface-3"),
      colorText: hsl("--foreground"),
      colorTextSecondary: hsl("--muted-foreground"),
      colorDanger: hsl("--destructive"),
      colorSuccess: hsl("--success"),
      fontFamily: "Inter Variable, Inter, system-ui, sans-serif",
      fontSizeBase: "15px",
      borderRadius: "10px",
      spacingUnit: "4px",
      focusBoxShadow: `0 0 0 2px ${hsl("--primary", 0.28)}`,
      focusOutline: "none",
    },
    rules: {
      ".Input": {
        backgroundColor: hsl("--surface-4"),
        border: `1px solid ${hsl("--foreground", 0.1)}`,
        boxShadow: "none",
        color: hsl("--foreground"),
        padding: "12px",
      },
      ".Input:focus": {
        border: `1px solid ${hsl("--primary", 0.55)}`,
        boxShadow: `0 0 0 2px ${hsl("--primary", 0.22)}`,
      },
      ".Input--invalid": {
        border: `1px solid ${hsl("--destructive")}`,
      },
      ".Label": {
        color: hsl("--muted-foreground"),
        fontWeight: "500",
        fontSize: "13px",
      },
      ".Tab": {
        backgroundColor: hsl("--surface-4"),
        border: `1px solid ${hsl("--foreground", 0.08)}`,
        color: hsl("--muted-foreground"),
      },
      ".Tab--selected": {
        backgroundColor: hsl("--surface-5"),
        border: `1px solid ${hsl("--primary", 0.42)}`,
        color: hsl("--foreground"),
      },
      ".Error": {
        color: hsl("--destructive"),
      },
    },
  };
}
