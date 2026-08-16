/**
 * Structural vocabulary (V2) — the alternative to reaching for a Card.
 *
 * THE PROBLEM THESE SOLVE
 * Before V2 the product had exactly one way to say "these things belong
 * together": wrap them in a rounded rectangle with a border. Measured on
 * one dashboard, that produced 19 bordered elements and 42 rounded boxes,
 * every boundary drawn at roughly the same weight. Hierarchy had to be
 * expressed by nesting more boxes, which is why the interface read as a
 * component-library sample rather than an instrument.
 *
 * A group of related information should be separable by ALIGNMENT,
 * HAIRLINES, SPACING and REGISTER before anything gets a container. These
 * primitives make that the easy path.
 *
 *   Rail      a structural line. The only element that uses --rail.
 *   RowGroup  a set of rows separated by hairlines. No outer box.
 *   Row       one record: optional marker, content, machine register.
 *   Ticks     registration marks — technical-drawing corners that bound a
 *             region without drawing a border around it.
 *
 * None of these own a fill. That is deliberate: fill is what makes a thing
 * a Plane, and a Plane is a decision, not a default.
 */
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------
   Rail — a structural divider.

   Uses --rail, which V1 defines as the strongest line role and reserves
   for structure. Everything else in the product should be using
   --line-soft or --line; if a rule wants to be this confident it is
   claiming to be structural, and that claim should be rare.
   ------------------------------------------------------------------ */
export function Rail({
  orientation = "vertical",
  className,
}: {
  orientation?: "vertical" | "horizontal";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block shrink-0 bg-rail",
        orientation === "vertical" ? "w-px self-stretch" : "h-px w-full",
        className,
      )}
    />
  );
}

/* ------------------------------------------------------------------
   Registration marks. Four corner brackets that bound a region without
   enclosing it — the region reads as measured and deliberate, but the
   eye is not asked to parse a box. Decorative, so aria-hidden.
   ------------------------------------------------------------------ */
export function Ticks({ className }: { className?: string }) {
  const base = "pointer-events-none absolute h-2 w-2 border-line";
  return (
    <span aria-hidden="true" className={className}>
      <span className={cn(base, "left-0 top-0 border-l border-t")} />
      <span className={cn(base, "right-0 top-0 border-r border-t")} />
      <span className={cn(base, "bottom-0 left-0 border-b border-l")} />
      <span className={cn(base, "bottom-0 right-0 border-b border-r")} />
    </span>
  );
}

/* ------------------------------------------------------------------
   RowGroup — a list of records with no container.

   divide-y is the whole mechanism: rows are separated by the weakest
   line role, and the group's edges are open. Compare to the previous
   pattern, `rounded-xl border overflow-hidden divide-y`, which drew a
   box AND internal rules and therefore spent two visual devices to
   express one relationship.
   ------------------------------------------------------------------ */
export function RowGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("divide-y divide-line-soft", className)}>{children}</div>;
}

/* ------------------------------------------------------------------
   Row — one record.

   `marker` is a narrow leading slot for a state indicator or a bare icon
   — NOT a tinted rounded chip. `register` is the trailing machine-language
   slot (status, count, timestamp), which is why it defaults to the mono
   register rather than another shade of small grey sans.

   `interactive` adds the local RESPOND treatment: the row's own surface
   lifts one step and the leading edge lights. No translate, no scale —
   material response, not movement.
   ------------------------------------------------------------------ */
interface RowOwnProps {
  marker?: ReactNode;
  register?: ReactNode;
  interactive?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * V3 amended the signature. As shipped in V2, Row was a hard-coded <div>,
 * and the first three real consumers — capture actions, notification items,
 * the module list — are all buttons or links. A div cannot be any of them,
 * and wrapping a button inside a Row would have put the hit target and the
 * layout on different elements.
 *
 * Rather than bend those surfaces to fit the primitive, the primitive became
 * polymorphic. `as` also carries the interaction props through, so an
 * interactive Row is genuinely the <button> — one element, one focus ring,
 * one hit area.
 */
export function Row<E extends ElementType = "div">(
  props: RowOwnProps & { as?: E } & Omit<ComponentPropsWithoutRef<E>, keyof RowOwnProps | "as">,
) {
  const { as, marker, register, interactive = false, className, children, ...rest } =
    props as RowOwnProps & { as?: ElementType } & Record<string, unknown>;
  const Comp = (as ?? "div") as ElementType;

  return (
    <Comp
      className={cn(
        "flex w-full items-start gap-3 px-1 py-3 text-left",
        interactive && "focus-ring motion-respond transition-colors hover:bg-surface-2",
        className,
      )}
      {...rest}
    >
      {marker !== undefined && (
        <span className="mt-0.5 flex w-4 shrink-0 justify-center text-disabled-foreground">
          {marker}
        </span>
      )}
      <div className="min-w-0 flex-1">{children}</div>
      {register !== undefined && (
        <span className="text-machine mt-0.5 shrink-0 whitespace-nowrap">{register}</span>
      )}
    </Comp>
  );
}

/* ------------------------------------------------------------------
   Plane — a bounded surface, and a DECISION rather than a default.

   Something earns a Plane when it is genuinely a separate layer from the
   page: it holds a different kind of content, or it floats. A group of
   related rows does not qualify — that is a RowGroup.

   Consumes V1 wholesale: --line-soft edge, surface radius, the
   directional edge-light pair and the occlusion set, all via `.surface`.

   `interactive` is opt-in and does NOT lift. V1 removed the violet halo
   from the hover shadow; V2 removes the 2px translate as well, because a
   universal hover-lift makes a page of planes jitter and says nothing
   about what is actually actionable. An interactive Plane responds by
   brightening its edge — local, material, and cheap to composite.
   ------------------------------------------------------------------ */
export function Plane({
  interactive = false,
  className,
  children,
}: {
  interactive?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "surface",
        interactive && "motion-respond transition-[border-color,background-color] hover:border-line-strong",
        className,
      )}
    >
      {children}
    </div>
  );
}
