/**
 * Starfield — the sky of the spatial environment, and the only thing on
 * screen that tells you the camera is moving.
 *
 * ONE FIELD, TWO SPEEDS
 * There is no "login starfield" and "transition starfield". There is one
 * canvas, mounted once by SpaceField, that never unmounts between the
 * sign-in route and the workspace. `stage` changes the CAMERA VELOCITY it
 * is easing toward; it does not change what is drawn or reseed anything.
 * That is deliberate: a second field, however identical in style, would
 * produce a visible cut at exactly the frame the user is watching most
 * closely.
 *
 * Motion is always radial from the centre of the frame, at every speed —
 * idle is the same forward travel as the cinematic, roughly three hundred
 * times slower. So acceleration is a change of magnitude, never a change
 * of direction, and the transition has nothing to snap.
 *
 * WHAT IT IS NOT
 * Not hyperspace. The radial stretch is capped (see MAX_STRETCH) at a
 * value that reads as a fast exposure, not as a streak: at peak velocity a
 * star gains about a third of its own width. No tunnel, no rays, no
 * particles thrown at the lens.
 *
 * PERFORMANCE CONTRACT
 *  - Zero React state per frame; one rAF loop over refs.
 *  - Zero layout reads per frame; size comes from a ResizeObserver.
 *  - No filter, blur, backdrop-filter or box-shadow anywhere. Every star
 *    is a pre-rendered sprite blitted with drawImage, so a frame is N
 *    textured quads and nothing else.
 *  - Star count is derived from viewport area and hard-capped, so a 4K
 *    panel gets a denser sky, not an unbounded one.
 *  - The loop stops on hidden tab and on unmount.
 *  - prefers-reduced-motion draws ONE static frame and starts no loop.
 *
 * Decorative: aria-hidden, pointer-events none, no semantics.
 */
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui";

export type StarfieldStage = "idle" | "travel";

interface StarfieldProps {
  className?: string;
  stage?: StarfieldStage;
}

interface Star {
  x: number;
  y: number;
  /** Depth 0..1 — drives parallax speed, size and brightness together. */
  z: number;
  /** Core radius in CSS px. */
  r: number;
  /** Resting alpha before twinkle. */
  a: number;
  /** Twinkle angular speed (rad/s). 0 = this star does not twinkle. */
  tw: number;
  tp: number;
  sprite: HTMLCanvasElement;
  /** Sprite's bucketed radius, so draw size can be derived without a map. */
  bucket: number;
}

/**
 * Star colours. A real sky is not uniformly white, and the variation is
 * what stops a procedural field reading as noise. None of this is the
 * product's accent violet.
 */
const TINTS: Array<[number, number, number]> = [
  [255, 255, 255],
  [202, 222, 255],
  [255, 233, 209],
];
const TINT_WEIGHTS = [0.72, 0.21, 0.07];

/** One star per this many CSS px², then hard-capped. */
const AREA_PER_STAR = 4200;
const MIN_STARS = 90;
const MAX_STARS = 700;

/** Past 2x the extra fill rate buys nothing visible. */
const MAX_DPR = 2;

/**
 * Camera velocity, as a fraction of distance-from-centre travelled per
 * second. Idle is a crawl you notice only after several seconds; travel is
 * a deliberate forward move. Nothing in between is ever set directly — the
 * loop eases from one to the other.
 */
const V_IDLE = 0.004;
const V_TRAVEL = 1.25;
/** Seconds for velocity to reach travel speed. Matches the camera ease. */
const V_RAMP_S = 1.1;
/**
 * Hard ceiling on radial elongation. This is the anti-hyperspace clamp: at
 * this value a star at peak velocity gains about a third of its own width
 * along the radial axis, which reads as a fast exposure. Anything much
 * above it starts drawing streaks.
 */
const MAX_STRETCH = 0.3;

function makeSprite(radiusPx: number, tint: [number, number, number], dpr: number) {
  const c = document.createElement("canvas");
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
 * The brightest few stars get a faint cross. It is a lens artefact, so it
 * belongs to a handful of stars only — past that it stops reading as
 * optics and starts reading as decoration.
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

export function Starfield({ className, stage }: StarfieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /**
   * The stage the loop reads. Written by a store subscription rather than
   * passed through React render, so a stage change is one ref write and
   * never a re-render of a component that owns a canvas.
   */
  const stageRef = useRef<StarfieldStage>(stage ?? "idle");

  useEffect(() => {
    if (stage) stageRef.current = stage;
  }, [stage]);

  useEffect(() => {
    if (stage) return undefined;
    const read = () => {
      stageRef.current = useUiStore.getState().spaceStage === "travel" ? "travel" : "idle";
    };
    read();
    return useUiStore.subscribe(read);
  }, [stage]);

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
    /** Seconds of playback — twinkle clock. */
    let clock = 0;
    /** Seconds spent in "travel" — drives the velocity ramp. */
    let travelClock = 0;
    /** Current camera velocity, eased. Never assigned from stage directly. */
    let velocity = V_IDLE;

    const spriteCache = new Map<string, HTMLCanvasElement>();
    const bucketOf = (radius: number) => Math.max(0.25, Math.round(radius * 4) / 4);
    const spriteFor = (bucket: number, tintIndex: number, flare: boolean) => {
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
      const bucket = bucketOf(r);
      const a = Math.min(1, (0.3 + Math.pow(Math.random(), 1.5) * 0.68) * (0.6 + z * 0.55));

      let x: number;
      let y: number;
      if (spawnNearCentre) {
        // Reappear near the vanishing point, so stars stream outward from
        // where the camera is heading rather than popping in at the edges.
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.pow(Math.random(), 0.6) * Math.min(width, height) * 0.14;
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
        // Roughly half the field twinkles. A fully twinkling sky shimmers
        // and reads as an effect rather than as depth.
        tw: Math.random() < 0.52 ? 0.35 + Math.random() * 0.9 : 0,
        tp: Math.random() * Math.PI * 2,
        sprite: spriteFor(bucket, t, r > 1.85),
        bucket,
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

      const cx = width / 2;
      const cy = height / 2;
      // Elongation is a function of velocity alone, and clamped. This is
      // the line that keeps the effect on the right side of tasteful.
      const stretch = Math.min(MAX_STRETCH, Math.max(0, (velocity - 0.2) * 0.5));

      for (let i = 0; i < stars.length; i += 1) {
        const s = stars[i];
        const twinkle = s.tw === 0 ? 1 : 0.74 + 0.26 * Math.sin(clock * s.tw + s.tp);
        const alpha = s.a * twinkle;
        if (alpha <= 0.01) continue;

        const size = (s.sprite.width / dpr) * (s.r / s.bucket);
        let w = size;
        let h = size;

        if (stretch > 0.001) {
          // Elongate along the radial direction, scaled by depth so near
          // stars smear more than far ones — which is what parallax at
          // speed actually looks like.
          const dx = s.x - cx;
          const dy = s.y - cy;
          const d = Math.hypot(dx, dy) || 1;
          const k = stretch * (0.35 + s.z);
          w = size * (1 + (k * Math.abs(dx)) / d);
          h = size * (1 + (k * Math.abs(dy)) / d);
        }

        ctx.globalAlpha = alpha;
        ctx.drawImage(s.sprite, s.x - w / 2, s.y - h / 2, w, h);
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    const step = (dtRaw: number) => {
      // Clamp dt so a backgrounded tab or a long task cannot teleport the
      // whole field on the next frame.
      const dt = Math.min(dtRaw, 0.05);
      clock += dt;

      const travelling = stageRef.current === "travel";
      if (travelling) travelClock += dt;
      else travelClock = 0;

      // Target velocity: idle crawl, or the ramped travel speed.
      const ramp = travelling ? Math.min(1, travelClock / V_RAMP_S) : 0;
      const target = travelling ? V_IDLE + Math.pow(ramp, 2.1) * (V_TRAVEL - V_IDLE) : V_IDLE;
      // Ease toward it rather than snapping, so even an abrupt stage flip
      // reads as the camera spinning up.
      velocity += (target - velocity) * Math.min(1, dt * 6);

      const cx = width / 2;
      const cy = height / 2;
      const margin = Math.max(width, height) * 0.1;

      for (let i = 0; i < stars.length; i += 1) {
        const s = stars[i];
        const speed = velocity * (0.35 + s.z);
        s.x += (s.x - cx) * speed * dt;
        s.y += (s.y - cy) * speed * dt;

        if (
          s.x < -margin ||
          s.x > width + margin ||
          s.y < -margin ||
          s.y > height + margin
        ) {
          stars[i] = makeStar(true);
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
    // The loop reads `stage` through stageRef, never through this closure,
    // so it is intentionally set up once for the life of the canvas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={cn("starfield", className)}
      aria-hidden="true"
      data-starfield=""
    />
  );
}
