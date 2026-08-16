/**
 * NexusOS product proxy — simplified shell geometry for cinematic presentation.
 * Must resemble real AppLayout (sidebar, header/search, workspace) for handoff.
 * Decorative only — no operational data, no invented metrics.
 */
export function NexusProductProxy({ className }: { className?: string }) {
  return (
    <div className={className ?? "nexus-product-proxy"} aria-hidden="true">
      <div className="nexus-product-chrome">
        <aside className="nexus-product-rail">
          <span className="nexus-product-brand" />
          <span className="nexus-product-nav" />
          <span className="nexus-product-nav" />
          <span className="nexus-product-nav nexus-product-nav--short" />
          <span className="nexus-product-nav" />
          <span className="nexus-product-nav nexus-product-nav--short" />
          <span className="nexus-product-nav" />
        </aside>
        <div className="nexus-product-body">
          <header className="nexus-product-bar">
            <span className="nexus-product-search" />
            <span className="nexus-product-actions" />
          </header>
          <div className="nexus-product-stage">
            <span className="nexus-product-hero" />
            <span className="nexus-product-signals" />
            <span className="nexus-product-ops">
              <span className="nexus-product-wave" />
              <span className="nexus-product-side" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
