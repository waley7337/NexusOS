/**
 * NexusOS product proxy — the object the camera is flying toward.
 *
 * WHY THIS WAS REBUILT
 * The previous version was uniform grey rounded bars in otherwise empty
 * panels. That is not "a product seen from a distance" — it is the exact
 * shape language of a loading skeleton, so the eye read it as "content is
 * still arriving" rather than "there is a system over there". Four things
 * cause that reading, and all four are fixed here:
 *
 *   1. every element the same rounded-bar primitive  → varied primitives:
 *      icon marks, chips, a real plotted chart, list rows, an avatar
 *   2. every element the same grey                   → hierarchy: one
 *      active nav row carries the accent, everything else recedes
 *   3. no focal point                                → the workspace has a
 *      title, a signal row and a dominant chart, in that order
 *   4. large empty panels                            → panels contain
 *      structure at the density the real product has
 *
 * The header's right side is now a single attached control CLUSTER rather
 * than one orphaned pill floating at the far edge — a detached control at
 * the frame edge is the other thing that made this read as a placeholder.
 *
 * TRUTHFULNESS
 * There is no text, no number, no label and no data anywhere in this file.
 * It is geometry: the *shape* of the product, drawn at a distance where
 * type would not be legible anyway. Nothing here asserts a fact, which is
 * exactly why a shape proxy is the honest way to show a product you have
 * not signed into yet.
 *
 * Decorative: aria-hidden, no semantics, no interaction.
 */

/** Static plot geometry — deterministic, so the shape never "flickers". */
const AREA_PATH =
  "M0,74 L0,52 C10,49 18,56 28,44 C38,33 46,40 56,30 C66,21 74,26 84,17 C92,10 96,13 100,8 L100,74 Z";
const LINE_PATH =
  "M0,52 C10,49 18,56 28,44 C38,33 46,40 56,30 C66,21 74,26 84,17 C92,10 96,13 100,8";

const SPARK_PATHS = [
  "M0,16 C6,14 10,17 16,11 C22,6 26,9 32,5",
  "M0,7 C6,10 10,6 16,12 C22,17 26,13 32,16",
  "M0,13 C6,15 10,9 16,10 C22,11 26,4 32,6",
  "M0,10 C6,6 10,12 16,8 C22,4 26,9 32,3",
];

/**
 * Rail entries. `active` marks the one row that carries the accent. The
 * counts are chosen so the rail is populated down its length — a sidebar
 * with five rows and then two-thirds emptiness is the other shape that
 * reads as "still loading".
 */
const NAV = [
  { active: true, width: "78%" },
  { active: false, width: "64%" },
  { active: false, width: "72%" },
  { active: false, width: "56%" },
  { active: false, width: "68%" },
  { active: false, width: "60%" },
  { active: false, width: "74%" },
];

const NAV_SECONDARY = [
  { width: "60%" },
  { width: "50%" },
  { width: "66%" },
  { width: "54%" },
];

export function NexusProductProxy({ className }: { className?: string }) {
  return (
    <div className={className ?? "nexus-product-proxy"} aria-hidden="true">
      <div className="nexus-product-chrome">
        {/* ---- rail ---- */}
        <aside className="nexus-product-rail">
          <div className="nexus-product-brand">
            <span className="nexus-product-brand-mark" />
            <span className="nexus-product-brand-word" />
          </div>

          <span className="nexus-product-grouplabel" />
          <div className="nexus-product-navgroup">
            {NAV.map((item, i) => (
              <span
                key={`primary-${i}`}
                className={`nexus-product-nav${item.active ? " is-active" : ""}`}
              >
                {item.active ? <span className="nexus-product-nav-marker" /> : null}
                <span className="nexus-product-nav-icon" />
                <span className="nexus-product-nav-label" style={{ width: item.width }} />
              </span>
            ))}
          </div>

          <span className="nexus-product-railrule" />

          <span className="nexus-product-grouplabel" />
          <div className="nexus-product-navgroup">
            {NAV_SECONDARY.map((item, i) => (
              <span key={`secondary-${i}`} className="nexus-product-nav">
                <span className="nexus-product-nav-icon" />
                <span className="nexus-product-nav-label" style={{ width: item.width }} />
              </span>
            ))}
          </div>

          <div className="nexus-product-railfoot">
            <span className="nexus-product-avatar" />
            <span className="nexus-product-nav-label" style={{ width: "62%" }} />
          </div>
        </aside>

        {/* ---- body ---- */}
        <div className="nexus-product-body">
          <header className="nexus-product-bar">
            <span className="nexus-product-crumbs">
              <span className="nexus-product-crumb" />
              <span className="nexus-product-crumb nexus-product-crumb--sep" />
              <span className="nexus-product-crumb nexus-product-crumb--long" />
            </span>

            <span className="nexus-product-search">
              <span className="nexus-product-search-glyph" />
              <span className="nexus-product-search-line" />
              <span className="nexus-product-search-key" />
            </span>

            {/* One attached cluster, not a control adrift at the edge. */}
            <span className="nexus-product-cluster">
              <span className="nexus-product-iconbtn" />
              <span className="nexus-product-iconbtn" />
              <span className="nexus-product-cta" />
              <span className="nexus-product-avatar nexus-product-avatar--sm" />
            </span>
          </header>

          <div className="nexus-product-stage">
            <div className="nexus-product-title">
              <span className="nexus-product-title-line" />
              <span className="nexus-product-title-sub" />
            </div>

            {/* Signal row — four tiles, each with its own plotted trend, so
                the row reads as instrumentation rather than four blanks. */}
            <div className="nexus-product-signals">
              {SPARK_PATHS.map((d, i) => (
                <span key={i} className="nexus-product-tile">
                  <span className="nexus-product-tile-label" />
                  <span className="nexus-product-tile-value" />
                  <svg
                    className="nexus-product-spark"
                    viewBox="0 0 32 20"
                    preserveAspectRatio="none"
                    focusable="false"
                  >
                    <path d={d} />
                  </svg>
                </span>
              ))}
            </div>

            <div className="nexus-product-ops">
              {/* Dominant chart — the focal point the old version lacked. */}
              <span className="nexus-product-wave">
                <span className="nexus-product-panelhead">
                  <span className="nexus-product-panelhead-title" />
                  <span className="nexus-product-panelhead-tag" />
                </span>
                <svg
                  className="nexus-product-plot"
                  viewBox="0 0 100 74"
                  preserveAspectRatio="none"
                  focusable="false"
                >
                  {/* Gridlines first: without them a filled curve reads as
                      a shape, with them it reads as a chart. */}
                  {[18, 36, 54].map((y) => (
                    <line key={y} className="nexus-product-plot-grid" x1="0" x2="100" y1={y} y2={y} />
                  ))}
                  <path className="nexus-product-plot-area" d={AREA_PATH} />
                  <path className="nexus-product-plot-line" d={LINE_PATH} />
                </svg>
              </span>

              <span className="nexus-product-side">
                <span className="nexus-product-panelhead">
                  <span className="nexus-product-panelhead-title" />
                </span>
                {[76, 62, 84, 58, 70].map((w, i) => (
                  <span key={i} className="nexus-product-listrow">
                    <span className="nexus-product-dot" />
                    <span className="nexus-product-listline" style={{ width: `${w}%` }} />
                  </span>
                ))}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
