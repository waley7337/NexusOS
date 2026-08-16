import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "2rem", screens: { "2xl": "1400px" } },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        // LifeOS convergence, Commit A — the six-step neutral ladder that
        // --background/--card/--muted/--secondary/--accent now alias into.
        // Use these directly when a surface needs an explicit elevation
        // level rather than a semantic role (shell chrome, control fills).
        surface: {
          0: "hsl(var(--surface-0))",
          1: "hsl(var(--surface-1))",
          2: "hsl(var(--surface-2))",
          3: "hsl(var(--surface-3))",
          4: "hsl(var(--surface-4))",
          5: "hsl(var(--surface-5))",
        },
        // Translucent hairlines. Complete rgb() values (not HSL triplets),
        // so a border composites over whatever surface is beneath it.
        // Five line roles (V1). Weakest that still communicates wins.
        line: {
          DEFAULT: "var(--line)",       // interactive edge
          soft: "var(--line-soft)",     // normal surface edge — the default
          strong: "var(--line-strong)", // interactive, engaged
          focus: "var(--line-focus)",   // the one line carrying violet
          transient: "var(--line-transient)",
        },
        // Structural divider. The only line allowed to span a whole region.
        rail: "var(--rail)",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          // Deep violet for filled controls carrying white labels
          // (#5B51E8, white → 5.49:1). Button adopts this in Commit C.
          fill: "hsl(var(--primary-fill))",
          soft: "hsl(var(--primary-soft))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        success: { DEFAULT: "hsl(var(--success))", foreground: "hsl(var(--success-foreground))" },
        warning: { DEFAULT: "hsl(var(--warning))", foreground: "hsl(var(--warning-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        info: { DEFAULT: "hsl(var(--info))", foreground: "hsl(var(--info-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        disabled: { foreground: "hsl(var(--disabled-foreground))" },
        // Part 04 — Core Platform, Phase 1 (Design Tokens 2.0): additive only.
        glow: {
          primary: "hsl(var(--glow-primary))",
          success: "hsl(var(--glow-success))",
          warning: "hsl(var(--glow-warning))",
        },
        "surface-glass": "hsl(var(--surface-glass))",
        "surface-glass-border": "hsl(var(--surface-glass-border))",
        // Single scrim for every modal layer. Complete rgb(), like `line`.
        "overlay-scrim": "var(--overlay-scrim)",
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
          6: "hsl(var(--chart-6))",
        },
      },
      // ONE radius family (V1). Semantic aliases first, then a REMAP of
      // Tailwind's own scale. The remap is the load-bearing half: measured
      // on the dashboard, six radii rendered at once (4/6/8/10/12/9999px)
      // and the widest spread came from raw `rounded-lg` / `rounded-xl` /
      // `rounded-md` in ~40 components, which never touched --radius-*.
      // Pointing the default scale at the same two values means the whole
      // product inherits the family without editing those components.
      // `full` is deliberately NOT remapped — it stays a real pill, but is
      // reserved for status dots and avatars.
      borderRadius: {
        // semantic
        btn: "var(--radius-btn)",         // 6px  — controls
        input: "var(--radius-input)",     // 6px  — controls
        card: "var(--radius-card)",       // 4px  — planes
        dialog: "var(--radius-dialog)",   // 4px  — regions
        surface: "var(--radius-surface)", // 4px  — planes
        // family
        control: "var(--r-control)",
        plane: "var(--r-surface)",
        // remapped Tailwind defaults
        none: "0px",
        sm: "var(--r-surface)",
        DEFAULT: "var(--r-surface)",
        md: "var(--r-control)",
        lg: "var(--r-control)",
        xl: "var(--r-surface)",
        "2xl": "var(--r-surface)",
        "3xl": "var(--r-surface)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        hover: "var(--shadow-hover)",
        dropdown: "var(--shadow-dropdown)",
        modal: "var(--shadow-modal)",
        // Composed recipes: ladder fill + inset top highlight + drop shadow.
        surface: "var(--shadow-surface)",
        lift: "var(--shadow-lift)",
        inset: "var(--surface-inset)",
      },
      zIndex: {
        sticky: "var(--z-sticky)",
        dropdown: "var(--z-dropdown)",
        overlay: "var(--z-overlay)",
        modal: "var(--z-modal)",
        toast: "var(--z-toast)",
      },
      // Motion bands. These were literals duplicating the --duration-* /
      // --ease-* tokens in globals.css; they now reference them, so the
      // stylesheet is the single source of truth and a timing can't drift
      // between the CSS and the utility that claims to apply it.
      transitionDuration: {
        instant: "var(--duration-instant)",
        fast: "var(--duration-fast)",
        base: "var(--duration-base)",
        standard: "var(--duration-standard)",
        slow: "var(--duration-slow)",
        spatial: "var(--duration-spatial)",
        reveal: "var(--duration-reveal)",
      },
      transitionTimingFunction: {
        brand: "var(--ease)",
        // LifeOS entrance curve — long tail, no overshoot.
        "out-expo": "var(--ease-out-expo)",
        "out-quart": "var(--ease-out-quart)",
        "in-out-quint": "var(--ease-in-out-quint)",
      },
      backdropBlur: { overlay: "var(--overlay-blur)" },
      // Shell geometry, for the Phase B sidebar work.
      width: {
        sidebar: "var(--sidebar-w)",
        "sidebar-collapsed": "var(--sidebar-w-collapsed)",
      },
      height: { "shell-header": "var(--shell-header-h)" },
      // §4.6 — 8px system: only these values are sanctioned for layout gaps
      spacing: { 4.5: "1.125rem" },
      fontFamily: {
        sans: ["Inter Variable", "Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      // 11px step for dense shell chrome (eyebrows, status strings, keycaps,
      // tile labels). The scale previously bottomed out at text-xs/12px, which
      // is why every label competed with body copy for weight.
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.02em" }],
      },
    },
  },
  plugins: [animate],
} satisfies Config;
