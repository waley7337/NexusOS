import path from "node:path";
import { createRequire } from "node:module";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { NEXUS_FRONTEND, NEXUS_SRC, PORTFOLIO_ROOT } from "./nexus.config";

const require = createRequire(import.meta.url);

/**
 * NexusOS source files import these bare specifiers. Their own
 * node_modules is not installed on a portfolio build, so every one of them
 * must resolve from this package instead. CSS @imports are not covered by
 * `dedupe`, hence explicit aliases for the font packages.
 */
const SHARED_PACKAGES = [
  "react",
  "react-dom",
  "zustand",
  "clsx",
  "tailwind-merge",
  "class-variance-authority",
  "lucide-react",
  "@radix-ui/react-dialog",
];

const pkgDir = (name: string) => path.dirname(require.resolve(`${name}/package.json`));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^~\//, replacement: `${path.join(PORTFOLIO_ROOT, "src")}/` },
      { find: /^@\//, replacement: `${NEXUS_SRC}/` },
      { find: "@fontsource-variable/inter", replacement: pkgDir("@fontsource-variable/inter") },
      { find: "@fontsource/jetbrains-mono", replacement: pkgDir("@fontsource/jetbrains-mono") },
    ],
    dedupe: SHARED_PACKAGES,
  },
  server: {
    fs: { allow: [PORTFOLIO_ROOT, NEXUS_FRONTEND] },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: { react: ["react", "react-dom"] },
      },
    },
  },
});
