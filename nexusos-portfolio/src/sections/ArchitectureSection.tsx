import { useState } from "react";
import { Maximize2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { multiTenantFlow, securityArchitecture, systemArchitecture, type Asset } from "~/data/assets";
import { nexusos } from "~/data/nexusos";
import { AssetPreviewDialog } from "~/components/AssetPreviewDialog";
import { Section } from "~/sections/Section";

const DIAGRAMS = [
  { asset: systemArchitecture, label: "Architecture", copy: nexusos.architecture.system },
  { asset: securityArchitecture, label: "Security", copy: nexusos.architecture.security },
  { asset: multiTenantFlow, label: "Multi-tenancy", copy: nexusos.architecture.tenancy },
];

export function ArchitectureSection() {
  const [preview, setPreview] = useState<Asset | null>(null);
  return (
    <Section
      id="architecture"
      title="Architecture"
      subtitle="Diagrams derived from the implemented NexusOS codebase. Click to inspect at full size."
    >
      <div className="space-y-6">
        {DIAGRAMS.map(({ asset, label, copy }, i) => (
          <div
            key={asset.id}
            className="grid items-center gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]"
            data-diagram={asset.id}
          >
            <Card interactive className={i % 2 === 1 ? "overflow-hidden lg:order-2" : "overflow-hidden"}>
              <button
                type="button"
                onClick={() => setPreview(asset)}
                className="focus-ring group relative block w-full"
                aria-label={`Open ${asset.title}`}
              >
                <img src={asset.preview} alt={asset.title} loading="lazy" className="block h-auto w-full" />
                <span className="absolute right-3 top-3 rounded-control border border-line bg-surface-2/90 p-1.5 opacity-0 transition-opacity duration-fast group-hover:opacity-100 group-focus-visible:opacity-100">
                  <Maximize2 className="h-4 w-4" aria-hidden="true" />
                </span>
              </button>
            </Card>
            <div className="space-y-2">
              <p className="eyebrow">{label}</p>
              <h3 className="text-h2">{asset.title}</h3>
              <p className="text-body text-muted-foreground">{copy}</p>
            </div>
          </div>
        ))}
      </div>
      <AssetPreviewDialog asset={preview} onClose={() => setPreview(null)} />
    </Section>
  );
}
