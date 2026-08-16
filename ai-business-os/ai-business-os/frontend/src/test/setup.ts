import "@testing-library/jest-dom/vitest";

/**
 * Node 25's built-in `localStorage` global ships broken without a
 * `--localstorage-file` flag (`setItem is not a function`) and shadows
 * jsdom's own implementation in the test environment. Auth-store tests rely
 * on zustand's `persist` middleware, so give it a working in-memory stand-in.
 */
if (typeof localStorage === "undefined" || typeof localStorage.setItem !== "function") {
  class MemoryStorage implements Storage {
    private store = new Map<string, string>();
    get length() {
      return this.store.size;
    }
    clear = () => this.store.clear();
    getItem = (key: string) => this.store.get(key) ?? null;
    key = (index: number) => Array.from(this.store.keys())[index] ?? null;
    removeItem = (key: string) => void this.store.delete(key);
    setItem = (key: string, value: string) => void this.store.set(key, String(value));
  }

  Object.defineProperty(globalThis, "localStorage", {
    value: new MemoryStorage(),
    writable: true,
    configurable: true,
  });
}

/**
 * jsdom doesn't implement `matchMedia`. `useMediaQuery` (and, via it,
 * `useCountUp`) is now genuinely used by shipped components (StatCard,
 * Part 04 Phase 8), not a one-off — so this is permanent test
 * infrastructure, not a stub to remove later. Defaults to "no match"
 * (motion not reduced); tests that care about prefers-reduced-motion
 * override `window.matchMedia` themselves (see useCountUp.test.ts).
 */
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

/**
 * jsdom has no 2D canvas without the native `canvas` package, and calling
 * getContext() there logs a "Not implemented" error through jsdom's virtual
 * console for every render. Starfield already treats a null context as
 * "this environment cannot draw" and bails before it observes or animates
 * anything, so the correct test behaviour is exactly that — return null
 * quietly rather than install a fake 2D context that would let the draw
 * path run against a surface nobody can assert on.
 */
if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = (() => null) as HTMLCanvasElement["getContext"];
}
