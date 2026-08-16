/**
 * Starfield — the deep-space layer of the pre-login cinematic.
 *
 * WHY A CANVAS AND NOT CSS
 * A CSS starfield is a handful of `radial-gradient` dots on a translated
 * layer. It reads as "dots on a div": the star count is fixed regardless of
 * viewport, every star is the same brightness curve, nothing twinkles, and
 * on a 4K panel the dots are resampled and go soft. This draws into a
 * device-pixel-backed canvas instead, so each star is rendered at the
 * display's real resolution — crisp at 1x, crisp at 2x, crisp at 4K — with a
 * per-star size, brightness, tint and twinkle phase.
 *
 * PERFORMANCE CONTRACT (this is the whole reason it is built this way)
 *  - Zero React state per frame. The animation lives entirely in refs and a
 *    single requestAnimationFrame loop; React re-renders exactly never
 *    during playback.
 *  - Zero layout reads per frame. Dimensions come from one ResizeObserver,
 *    not from getBoundingClientRect() in the loop.
 *  - No `filter`, no `backdrop-filter`, no `box-shadow`, no `blur` — the
 *    glow is baked into pre-rendered sprites once, then blitted with
 *    drawImage. Per frame the GPU does N textured quads and nothing else.
 *  - The loop stops when the tab is hidden and when the component unmounts.
 *  - prefers-reduced-motion renders ONE static frame and never starts a
 *    loop. The sky is still there; it just isn't moving.
 *
 * TWO MODES
 *  "drift" — the sign-in sky. Slow lateral parallax by depth. This is the
 *            resting state of the world, so it is deliberately near the
 *            threshold of perception: you notice it after a few seconds,
 *            not immediately.
 *  "warp"  — the immersion continuation. Stars accelerate radially outward
 *            from the camera centre, which is what forward motion actually
 *            looks like. Used while the product proxy approaches, so the
 *            sky and the camera agree about which way we are travelling.
 *
 * Decorative. aria-hidden, pointer-events: none, no semantics.
 */
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export type StarfieldMode = "drift" | "warp";

interface StarfieldProps {
  className?: string;
  mode?: StarfieldMode;
}

/** One star. Plain object in a flat array — no allocation during playback. */
interface Star {
  x: number;
  y: number;
  /** Depth 0..1. Drives parallax speed, size and brightness together. */
  z: number;
  /** Core radius in CSS px. */
  r: number;
  /** Resting alpha before twinkle. */
  a: number;
  /** Twinkle angular speed (rad/s). 0 means this star does not twinkle. */
  tw: number;
  /** Twinkle phase offset so the field never pulses in unison. */
  tp: number;
  /** Index into TINTS. */
  t: number;
  /** Pre-resolved sprite for this star. */
  sprite: HTMLCanvasElement;
}

/**
 * Star colours. Real skies are not uniformly white — the variation is what
 * stops a starfield reading as noise. Kept subtle: at these alphas the tint
 * is felt more than seen, and none of it is the product's accent violet.
 */
const TINTS: Array<[number, number, number]> = [
  [255, 255, 255], // neutral — the majority
  [202, 222, 255], // cool blue-white
  [255, 233, 209], // warm
];

/** Chance of drawing each tint. Must sum to 1. */
const TINT_WEIGHTS = [0.72, 0.21, 0.07];

/**
 * One star per this many CSS px². Density is area-derived, not a fixed
 * count, so a 13" laptop and a 4K panel get the same sky rather than the
 * same number of dots spread thinner.
 */
const AREA_PER_STAR = 3500;
// A phone viewport is small in area but held close, so the floor is set
// above what pure area would give it — otherwise the sky reads as empty.
const MIN_STARS = 165;
const MAX_STARS = 1400;

/** Device pixel ratio is capped: past 2x the extra fill rate buys nothing. */
const MAX_DPR = 2;

/**
 * Pre-render one star sprite: a tight opaque core with a soft halo, baked
 * once into an offscreen canvas. Drawing 400 of these with drawImage is
 * cheap; drawing 400 radial gradients per frame is not.
 */
function makeSprite(radiusPx: number, tint: [number, number, number], dpr: number) {
  const c = document.createElement("canvas");
  // The halo reaches ~3.6x the core radius; anything beyond is invisible.
  const half = Math.max(2, Math.ceil(radiusPx * 3.6 * dpr));
  c.width = half * 2;
  c.height = half * 2;

  const ctx = c.getContext("2d");
  if (!ctx) return c;

  const [r, g, b] = tint;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  const core = Math.max(0.08, (radiusPx * dpr) / half);
  grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
  grad.addColorStop(core * 0.55, `rgba(${r},${g},${b},0.92)`);
  grad.addColorStop(core, `rgba(${r},${g},${b},0.34)`);
  grad.addColorStop(Math.min(0.98, core + 0.34), `rgba(${r},${g},${b},0.05)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(half, half, half, 0, Math.PI * 2);
  ctx.fill();

  return c;
}

/**
 * The few brightest stars get a faint anamorphic cross. This is the single
 * detail that separates "dots" from "photographed sky" — but it is a lens
 * artefact, so it belongs to a handful of stars only. More than that and it
 * stops reading as optics and starts reading as decoration.
 */
function addFlare(sprite: HTMLCanvasElement, tint: [number, number, number]) {
  const ctx = sprite.getContext("2d");
  if (!ctx) return sprite;
  const w = sprite.width;
  const h = sprite.height;
  const [r, g, b] = tint;

  ctx.globalCompositeOperation = "lighter";

  const horiz = ctx.createLinearGradient(0, 0, w, 0);
  horiz.addColorStop(0, `rgba(${r},${g},${b},0)`);
  horiz.addColorStop(0.5, `rgba(${r},${g},${b},0.5)`);
  horiz.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = horiz;
  ctx.fillRect(0, h / 2 - 0.5, w, 1);

  const vert = ctx.createLinearGradient(0, 0, 0, h);
  vert.addColorStop(0, `rgba(${r},${g},${b},0)`);
  vert.addColorStop(0.5, `rgba(${r},${g},${b},0.38)`);
  vert.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = vert;
  ctx.fillRect(w / 2 - 0.5, 0, 1, h);

  ctx.globalCompositeOperation = "source-over";
  return sprite;
}

function pickTint(): number {
  const n = Math.random();
  let acc = 0;
  for (let i = 0; i < TINT_WEIGHTS.length; i += 1) {
    acc += TINT_WEIGHTS[i];
    if (n < acc) return i;
  }
  return 0;
}

export function Starfield({ className, mode = "drift" }: StarfieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const parent = canvas.parentElement ?? canvas;

    let dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    let width = 0;
    let height = 0;
    let stars: Star[] = [];
    let raf = 0;
    let running = false;
    let last = 0;
    /** Seconds since the field started — twinkle clock and warp ramp. */
    let clock = 0;

    const spriteCache = new Map<string, HTMLCanvasElement>();
    const spriteFor = (radius: number, tintIndex: number, flare: boolean) => {
      // Bucket the radius so a few hundred stars share a dozen textures.
      const bucket = Math.max(0.25, Math.round(radius * 4) / 4);
      const key = `${tintIndex}|${bucket}|${flare ? "f" : "p"}|${dpr}`;
      const hit = spriteCache.get(key);
      if (hit) return hit;
      const tint = TINTS[tintIndex];
      const made = makeSprite(bucket, tint, dpr);
      spriteCache.set(key, flare ? addFlare(made, tint) : made);
      return spriteCache.get(key) as HTMLCanvasElement;
    };

    const makeStar = (spawnNearCentre: boolean): Star => {
      const z = Math.random();
      // Cubic skew: a sky is overwhelmingly faint pinpricks with a few
      // genuinely bright stars, not an even spread of medium dots.
      const r = 0.32 + Math.pow(Math.random(), 3) * 2.05 * (0.55 + z * 0.45);
      const t = pickTint();
      const flare = r > 1.85;
      // Brightness rides depth but is not determined by it — a real sky has
      // faint near stars and bright far ones, and locking the two together
      // is what makes procedural fields look like a gradient of dots.
      const a = Math.min(1, (0.3 + Math.pow(Math.random(), 1.5) * 0.68) * (0.6 + z * 0.55));

      let x: number;
      let y: number;
      if (spawnNearCentre) {
        // Warp respawn: reappear close to the vanishing point, so stars
        // stream outward from where the camera is heading.
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.pow(Math.random(), 0.6) * Math.min(width, height) * 0.16;
        x = width / 2 + Math.cos(angle) * dist;
        y = height / 2 + Math.sin(angle) * dist;
      } else {
        x = Math.random() * width;
        y = Math.random() * height;
      }

      return {
        x,
        y,
        z,
        r,
        a,
        // Roughly half the field twinkles; a fully twinkling sky shimmers
        // and reads as an effect rather than as depth.
        tw: Math.random() < 0.52 ? 0.35 + Math.random() * 0.9 : 0,
        tp: Math.random() * Math.PI * 2,
        t,
        sprite: spriteFor(r, t, flare),
      };
    };

    const populate = () => {
      const target = Math.max(
        MIN_STARS,
        Math.min(MAX_STARS, Math.round((width * height) / AREA_PER_STAR)),
      );
      stars = new Array(target);
      for (let i = 0; i < target; i += 1) stars[i] = makeStar(false);
    };

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      // Additive: overlapping halos accumulate light instead of punching
      // holes in each other, which is what makes dense regions glow.
      ctx.globalCompositeOperation = "lighter";

      for (let i = 0; i < stars.length; i += 1) {
        const s = stars[i];
        const twinkle = s.tw === 0 ? 1 : 0.74 + 0.26 * Math.sin(clock * s.tw + s.tp);
        const alpha = s.a * twinkle;
        if (alpha <= 0.01) continue;
        const size = (s.sprite.width / dpr) * (s.r / Math.max(0.25, Math.round(s.r * 4) / 4));
        ctx.globalAlpha = alpha;
        ctx.drawImage(s.sprite, s.x - size / 2, s.y - size / 2, size, size);
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    const step = (dtRaw: number) => {
      // Clamp dt so a backgrounded tab or a long task cannot teleport the
      // whole field on the next frame.
      const dt = Math.min(dtRaw, 0.05);
      clock += dt;

      if (mode === "warp") {
        // Ramp: the camera commits slowly, then accelerates. Matches the
        // ease of the product approach it plays underneath.
        const ramp = Math.min(1, clock / 1.15);
        const k = 0.1 + Math.pow(ramp, 2.1) * 1.35;
        const cx = width / 2;
        const cy = height / 2;
        const margin = Math.max(width, height) * 0.12;

        for (let i = 0; i < stars.length; i += 1) {
          const s = stars[i];
          const dx = s.x - cx;
          const dy = s.y - cy;
          const speed = k * (0.35 + s.z);
          s.x += dx * speed * dt;
          s.y += dy * speed * dt;
          // Approaching stars get brighter and larger, as they would.
          s.a = Math.min(1, s.a + dt * 0.06 * s.z);
          if (
            s.x < -margin ||
            s.x > width + margin ||
            s.y < -margin ||
            s.y > height + margin
          ) {
            stars[i] = makeStar(true);
          }
        }
      } else {
        // Drift: slow lateral parallax, up and to the left. Depth sets
        // speed, so the near layer visibly leads the far one.
        for (let i = 0; i < stars.length; i += 1) {
          const s = stars[i];
          const v = 0.9 + s.z * 3.4;
          s.x -= v * 0.82 * dt;
          s.y -= v * 0.34 * dt;
          if (s.x < -6) s.x = width + 6;
          if (s.y < -6) s.y = height + 6;
        }
      }
    };

    const frame = (now: number) => {
      if (!running) return;
      const dt = last === 0 ? 0.016 : (now - last) / 1000;
      last = now;
      step(dt);
      draw();
      raf = window.requestAnimationFrame(frame);
    };

    const start = () => {
      if (running) return;
      running = true;
      last = 0;
      raf = window.requestAnimationFrame(frame);
    };

    const stop = () => {
      running = false;
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
    };

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      if (w === width && h === height) return;
      width = w;
      height = h;
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      populate();
      draw();
    };

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const applyMotion = () => {
      if (motionQuery.matches) {
        stop();
        draw(); // one static sky — present, but still
      } else if (!document.hidden) {
        start();
      }
    };

    const onVisibility = () => {
      if (document.hidden) stop();
      else applyMotion();
    };

    resize();
    applyMotion();

    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    document.addEventListener("visibilitychange", onVisibility);
    motionQuery.addEventListener("change", applyMotion);

    return () => {
      stop();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      motionQuery.removeEventListener("change", applyMotion);
      spriteCache.clear();
    };
  }, [mode]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("starfield", className)}
      aria-hidden="true"
      data-starfield={mode}
    />
  );
}
