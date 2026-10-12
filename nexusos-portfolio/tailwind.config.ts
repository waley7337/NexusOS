import "./tailwind.shared-modules";
import path from "node:path";
import type { Config } from "tailwindcss";
import nexusPreset from "../ai-business-os/ai-business-os/frontend/tailwind.config";
import { NEXUS_FRONTEND, PORTFOLIO_ROOT } from "./nexus.config";

/**
 * The NexusOS Tailwind config is the preset, so every token-backed utility
 * (surface ladder, line roles, radius family, motion bands, fonts) resolves
 * exactly as it does in the product.
 */
export default {
  presets: [nexusPreset],
  content: [
    path.join(PORTFOLIO_ROOT, "index.html"),
    path.join(PORTFOLIO_ROOT, "src/**/*.{ts,tsx}"),
    // Only the NexusOS modules the portfolio renders, so their class names
    // are generated without scanning the whole product.
    path.join(NEXUS_FRONTEND, "src/components/{space-field,starfield,atmosphere}.tsx"),
    path.join(NEXUS_FRONTEND, "src/components/ui/{button,card,badge,section-header,structure,dialog}.tsx"),
  ],
} satisfies Config;
