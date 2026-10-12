/**
 * Neural field: a Canvas 2D engine for the portfolio's ambient network.
 *
 * Framework-free on purpose. React mounts it once (NeuralBackground) and
 * never re-renders for it; every frame is drawn here.
 *
 * Colours come from NexusOS tokens at runtime (--muted-foreground for nodes,
 * --primary for links, --info for pulses), so the field follows the theme
 * and never introduces a colour of its own.
 */

export interface NeuralFieldHandle {
  destroy: () => void;
}

interface Node {
  x: number;
  y: number;
  /** 0.35 (far) … 1 (near): scales size, brightness and drift speed. */
  depth: number;
  heading: number;
  speed: number;
  turnPhase: number;
  turnRate: number;
  glowPhase: number;
  glowRate: number;
}

interface Pulse {
  from: number;
  to: number;
  t: number;
  duration: number;
  hops: number;
}

type Rgb = [number, number, number];

const FRAME_MS = 1000 / 30;
const RESIZE_DEBOUNCE_MS = 150;
const MAX_DPR = 2;

/** Density tiers; small screens get fewer nodes, shorter links and fewer pulses. */
function tier(width: number) {
  if (width < 640) return { area: 26000, max: 34, link: 120, pulses: 2 };
  if (width < 1024) return { area: 20000, max: 56, link: 145, pulses: 3 };
  return { area: 16000, max: 88, link: 165, pulses: 4 };
}

function tokenRgb(name: string, fallback: Rgb): Rgb {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const m = raw.match(/^(-?[\d.]+)(?:deg)?\s+([\d.]+)%\s+([\d.]+)%/);
  if (!m) return fallback;
  const h = Number(m[1]) / 360;
  const s = Number(m[2]) / 100;
  const l = Number(m[3]) / 100;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const ch = (t: number) => {
    const u = (t + 1) % 1;
    const v = u < 1 / 6 ? p + (q - p) * 6 * u : u < 0.5 ? q : u < 2 / 3 ? p + (q - p) * (2 / 3 - u) * 6 : p;
    return Math.round(v * 255);
  };
  return [ch(h + 1 / 3), ch(h), ch(h - 1 / 3)];
}

const rgba = ([r, g, b]: Rgb, a: number) => `rgba(${r},${g},${b},${a.toFixed(3)})`;

export function createNeuralField(canvas: HTMLCanvasElement, opts: { random?: () => number } = {}): NeuralFieldHandle {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { destroy: () => {} };
  const rand = opts.random ?? Math.random;

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let width = 0;
  let height = 0;
  let nodes: Node[] = [];
  let pulses: Pulse[] = [];
  let linkDist = 150;
  let pulseCount = 4;
  let colors = { node: [148, 163, 184] as Rgb, link: [91, 155, 255] as Rgb, pulse: [56, 189, 248] as Rgb };

  let raf = 0;
  let last = 0;
  let acc = 0;
  let time = 0;
  let visible = true;
  let onScreen = true;
  let resizeTimer: ReturnType<typeof setTimeout> | undefined;

  const makeNode = (): Node => {
    const depth = 0.35 + rand() * 0.65;
    return {
      x: rand() * width,
      y: rand() * height,
      depth,
      heading: rand() * Math.PI * 2,
      speed: (3 + rand() * 5) * depth,
      turnPhase: rand() * Math.PI * 2,
      turnRate: 0.05 + rand() * 0.12,
      glowPhase: rand() * Math.PI * 2,
      glowRate: (Math.PI * 2) / (7 + rand() * 9),
    };
  };

  const readColors = () => {
    colors = {
      node: tokenRgb("--muted-foreground", colors.node),
      link: tokenRgb("--primary", colors.link),
      pulse: tokenRgb("--info", colors.pulse),
    };
  };

  /** Fit the backing store to the box; keep existing nodes (rescaled) so a resize never jumps. */
  const fit = () => {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (width && height) {
      for (const n of nodes) {
        n.x *= w / width;
        n.y *= h / height;
      }
    }
    width = w;
    height = h;
    const t = tier(w);
    linkDist = t.link;
    pulseCount = t.pulses;
    const target = Math.min(t.max, Math.round((w * h) / t.area));
    while (nodes.length < target) nodes.push(makeNode());
    nodes.length = target;
    pulses = pulses.filter((p) => p.from < target && p.to < target).slice(0, pulseCount);
    readColors();
  };

  const neighbour = (i: number, exclude = -1) => {
    const a = nodes[i];
    const near: number[] = [];
    for (let j = 0; j < nodes.length; j++) {
      if (j === i || j === exclude) continue;
      const d = Math.hypot(nodes[j].x - a.x, nodes[j].y - a.y);
      if (d < linkDist * 0.85) near.push(j);
    }
    return near.length ? near[Math.floor(rand() * near.length)] : -1;
  };

  const spawnPulse = (from = Math.floor(rand() * nodes.length), hops = 0, exclude = -1) => {
    if (!nodes.length) return;
    const to = neighbour(from, exclude);
    if (to < 0) return;
    pulses.push({ from, to, t: 0, duration: 1.8 + rand() * 1.4, hops });
  };

  const step = (dt: number) => {
    time += dt;
    const pad = 24;
    for (const n of nodes) {
      n.heading += Math.sin(time * n.turnRate + n.turnPhase) * 0.35 * dt;
      n.x += Math.cos(n.heading) * n.speed * dt;
      n.y += Math.sin(n.heading) * n.speed * dt;
      if (n.x < -pad) n.x = width + pad;
      else if (n.x > width + pad) n.x = -pad;
      if (n.y < -pad) n.y = height + pad;
      else if (n.y > height + pad) n.y = -pad;
    }
    const next: Pulse[] = [];
    for (const p of pulses) {
      p.t += dt / p.duration;
      if (p.t < 1) next.push(p);
      else if (p.hops < 2 && rand() < 0.55) {
        const to = neighbour(p.to, p.from);
        if (to >= 0) next.push({ from: p.to, to, t: 0, duration: 1.8 + rand() * 1.4, hops: p.hops + 1 });
      }
    }
    pulses = next;
    while (pulses.length < pulseCount && rand() < dt * 0.6) spawnPulse();
  };

  const draw = (withPulses: boolean) => {
    ctx.clearRect(0, 0, width, height);
    const max2 = linkDist * linkDist;
    ctx.lineWidth = 0.7;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > max2) continue;
        const near = 1 - Math.sqrt(d2) / linkDist;
        const flicker = 0.55 + 0.45 * Math.sin(time * 0.22 + (i * 7 + j * 13) * 0.37);
        const alpha = near ** 1.4 * Math.min(a.depth, b.depth) * flicker * 0.3;
        if (alpha < 0.004) continue;
        ctx.strokeStyle = rgba(colors.link, alpha);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
    for (const n of nodes) {
      const glow = 0.7 + 0.3 * Math.sin(time * n.glowRate + n.glowPhase);
      ctx.fillStyle = rgba(colors.node, (0.12 + 0.3 * n.depth) * glow);
      ctx.beginPath();
      ctx.arc(n.x, n.y, 0.6 + n.depth * 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
    if (!withPulses) return;
    for (const p of pulses) {
      const a = nodes[p.from];
      const b = nodes[p.to];
      if (!a || !b) continue;
      const ease = p.t * p.t * (3 - 2 * p.t);
      const x = a.x + (b.x - a.x) * ease;
      const y = a.y + (b.y - a.y) * ease;
      const fade = Math.sin(Math.PI * p.t);
      ctx.fillStyle = rgba(colors.pulse, 0.06 * fade);
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgba(colors.pulse, 0.42 * fade);
      ctx.beginPath();
      ctx.arc(x, y, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const frame = (now: number) => {
    raf = window.requestAnimationFrame(frame);
    const elapsed = last ? now - last : FRAME_MS;
    last = now;
    acc += elapsed;
    if (acc < FRAME_MS) return;
    step(Math.min(acc, 100) / 1000);
    acc = 0;
    draw(true);
  };

  const running = () => raf !== 0;
  const start = () => {
    if (running() || motion.matches || !visible || !onScreen) return;
    last = 0;
    raf = window.requestAnimationFrame(frame);
  };
  const stop = () => {
    if (!running()) return;
    window.cancelAnimationFrame(raf);
    raf = 0;
  };
  const sync = () => {
    if (motion.matches) {
      stop();
      draw(false);
    } else start();
  };

  const onVisibility = () => {
    visible = document.visibilityState !== "hidden";
    if (visible) start();
    else stop();
  };
  const onMotion = () => sync();
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      fit();
      if (!running()) draw(!motion.matches);
    }, RESIZE_DEBOUNCE_MS);
  };

  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onResize) : null;
  ro?.observe(canvas);
  const io =
    typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(([entry]) => {
          onScreen = entry?.isIntersecting ?? true;
          if (onScreen) start();
          else stop();
        })
      : null;
  io?.observe(canvas);
  document.addEventListener("visibilitychange", onVisibility);
  motion.addEventListener?.("change", onMotion);

  fit();
  visible = document.visibilityState !== "hidden";
  sync();

  return {
    destroy() {
      stop();
      clearTimeout(resizeTimer);
      ro?.disconnect();
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      motion.removeEventListener?.("change", onMotion);
    },
  };
}
