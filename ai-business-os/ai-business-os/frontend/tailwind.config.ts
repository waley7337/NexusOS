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
        line: {
          DEFAULT: "var(--line)",
          soft: "var(--line-soft)",
          strong: "var(--line-strong)",
        },
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
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
          6: "hsl(var(--chart-6))",
        },
      },
      borderRadius: {
        btn: "var(--radius-btn)",         // 10px — buttons
        input: "var(--radius-input)",     // 10px — inputs
        card: "var(--radius-card)",       // 12px — cards
        dialog: "var(--radius-dialog)",   // 16px — dialogs
        surface: "var(--radius-surface)", // 18px — elevated panels
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
      transitionDuration: { fast: "150ms", base: "200ms", slow: "250ms", reveal: "700ms" },
      transitionTimingFunction: {
        brand: "cubic-bezier(0.2, 0, 0, 1)",
        // LifeOS entrance curve — long tail, no overshoot.
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      // §4.6 — 8px system: only these values are sanctioned for layout gaps
      spacing: { 4.5: "1.125rem" },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
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
