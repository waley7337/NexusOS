import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NeuralBackground } from "~/animations/NeuralBackground";
import { createNeuralField } from "~/animations/neural-field";

function fakeContext() {
  const calls = { arc: 0, stroke: 0, clearRect: 0 };
  const ctx = {
    setTransform: vi.fn(),
    clearRect: vi.fn(() => calls.clearRect++),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(() => calls.stroke++),
    arc: vi.fn(() => calls.arc++),
    fill: vi.fn(),
    lineWidth: 1,
    strokeStyle: "",
    fillStyle: "",
  };
  return { ctx, calls };
}

function mockMotion(reduce: boolean) {
  const listeners = new Set<() => void>();
  const mql = {
    matches: reduce,
    media: "(prefers-reduced-motion: reduce)",
    addEventListener: vi.fn((_: string, cb: () => void) => listeners.add(cb)),
    removeEventListener: vi.fn((_: string, cb: () => void) => listeners.delete(cb)),
  };
  vi.spyOn(window, "matchMedia").mockReturnValue(mql as unknown as MediaQueryList);
  return { mql, listeners };
}

const observers: { disconnect: ReturnType<typeof vi.fn> }[] = [];
class ObserverStub {
  disconnect = vi.fn();
  constructor() {
    observers.push(this);
  }
  observe() {}
  unobserve() {}
}

let canvas: HTMLCanvasElement;
let calls: ReturnType<typeof fakeContext>["calls"];
let raf: ReturnType<typeof vi.fn>;
let caf: ReturnType<typeof vi.fn>;

beforeEach(() => {
  observers.length = 0;
  const fake = fakeContext();
  calls = fake.calls;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(fake.ctx as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 1200, height: 800 } as DOMRect);
  raf = vi.fn(() => 42);
  caf = vi.fn();
  vi.stubGlobal("requestAnimationFrame", raf);
  vi.stubGlobal("cancelAnimationFrame", caf);
  vi.stubGlobal("ResizeObserver", ObserverStub);
  vi.stubGlobal("IntersectionObserver", ObserverStub);
  canvas = document.createElement("canvas");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("neural field", () => {
  it("draws one static frame and never starts a loop under prefers-reduced-motion", () => {
    mockMotion(true);
    const field = createNeuralField(canvas, { random: () => 0.5 });
    expect(raf).not.toHaveBeenCalled();
    expect(calls.clearRect).toBe(1);
    expect(calls.arc).toBeGreaterThan(0);
    field.destroy();
  });

  it("animates when motion is allowed and stops when it becomes reduced", () => {
    const { mql, listeners } = mockMotion(false);
    const field = createNeuralField(canvas);
    expect(raf).toHaveBeenCalledTimes(1);
    mql.matches = true;
    listeners.forEach((cb) => cb());
    expect(caf).toHaveBeenCalledWith(42);
    field.destroy();
  });

  it("pauses while the tab is hidden", () => {
    mockMotion(false);
    const field = createNeuralField(canvas);
    const state = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(caf).toHaveBeenCalledWith(42);
    state.mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(raf).toHaveBeenCalledTimes(2);
    field.destroy();
  });

  it("caps the backing store at 2x device pixels", () => {
    mockMotion(true);
    vi.stubGlobal("devicePixelRatio", 3);
    createNeuralField(canvas).destroy();
    expect(canvas.width).toBe(2400);
    expect(canvas.height).toBe(1600);
  });

  it("cleans up the frame loop, observers and listeners on unmount", () => {
    const { mql } = mockMotion(false);
    const removeDoc = vi.spyOn(document, "removeEventListener");
    const { unmount, getByTestId } = render(<NeuralBackground />);
    const layer = getByTestId("neural-background");
    expect(layer).toHaveAttribute("aria-hidden", "true");
    expect(layer.querySelector(".scanlines")).not.toBeNull();
    expect(raf).toHaveBeenCalled();
    unmount();
    expect(caf).toHaveBeenCalledWith(42);
    expect(observers).toHaveLength(2);
    for (const o of observers) expect(o.disconnect).toHaveBeenCalled();
    expect(removeDoc).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    expect(mql.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });
});
