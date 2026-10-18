/**
 * Side-effect module, imported first by tailwind.config.ts.
 *
 * The NexusOS Tailwind config (used as a preset) imports
 * `tailwindcss-animate`. On a portfolio build only THIS package's
 * node_modules is installed, so it is added to Node's global lookup paths
 * before the preset is evaluated.
 */
import path from "node:path";
import Module from "node:module";
import { PORTFOLIO_ROOT } from "./nexus.config";

const portfolioModules = path.join(PORTFOLIO_ROOT, "node_modules");
process.env.NODE_PATH = [portfolioModules, process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
(Module as unknown as { _initPaths: () => void })._initPaths();
