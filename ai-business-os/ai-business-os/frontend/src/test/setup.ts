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
