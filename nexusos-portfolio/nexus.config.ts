/**
 * Where the NexusOS frontend lives relative to this package.
 *
 * The portfolio compiles NexusOS modules (tokens, SpaceField, Starfield,
 * UI primitives) from their real location instead of copying them, so this
 * path is the single coupling point between the two builds. If the NexusOS
 * frontend moves, change it here.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const PORTFOLIO_ROOT = here;
export const NEXUS_FRONTEND = path.resolve(here, "../ai-business-os/ai-business-os/frontend");
export const NEXUS_SRC = path.join(NEXUS_FRONTEND, "src");
