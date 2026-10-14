import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards the Tailwind v4 migration footguns that blanked radius/shadow tokens
 * and orphaned spatial CSS (login paste wash, missing stars, harsh layout).
 */
const globals = readFileSync(resolve(__dirname, "../globals.css"), "utf8");

describe("globals.css Tailwind v4 invariants", () => {
  it("uses @theme inline and does not self-reference radius/shadow theme keys", () => {
    expect(globals).toMatch(/@theme\s+inline\s*\{/);
    expect(globals).not.toMatch(/--radius-btn:\s*var\(--radius-btn\)/);
    expect(globals).not.toMatch(/--radius-input:\s*var\(--radius-input\)/);
    expect(globals).not.toMatch(/--shadow-sm:\s*var\(--shadow-sm\)/);
  });

  it("registers --sidebar-w outside @layer so chassis collapse can interpolate", () => {
    const prop = globals.indexOf("@property --sidebar-w");
    expect(prop).toBeGreaterThan(-1);
    const before = globals.slice(Math.max(0, prop - 80), prop);
    expect(before).not.toMatch(/@layer\s+utilities/);
  });

  it("keeps space-stars as a component class with travel handoff + keyframes", () => {
    expect(globals).toMatch(/\.space-stars\s*\{/);
    expect(globals).not.toMatch(/@utility\s+space-stars\b/);
    expect(globals).toMatch(/\.space-field\[data-space-stage=["']travel["']\]\s+\.space-stars/);
    expect(globals).toMatch(/@keyframes\s+space-stars-in/);
    expect(globals).toMatch(/@keyframes\s+space-travel-handoff/);
  });

  it("forces dark auth input fill/caret so paste/autofill stays readable", () => {
    expect(globals).toMatch(/\.auth-shell\s+input/);
    expect(globals).toMatch(/color-scheme:\s*dark/);
    expect(globals).toMatch(/-webkit-text-fill-color:\s*hsl\(var\(--foreground\)\)/);
    expect(globals).toMatch(/input:-webkit-autofill/);
  });
});
