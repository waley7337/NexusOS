import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cv } from "~/data/assets";
import { AssetActions } from "~/components/AssetPreviewDialog";
import { DocumentPreview } from "~/components/DocumentPreview";
import { Section } from "~/sections/Section";

export function CvSection() {
  return (
    <Section id="cv" title="CV" subtitle="The original document, unchanged — preview it here, open it, or download it.">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <DocumentPreview asset={cv} />
        <Card className="h-fit space-y-4 p-5">
          <div className="space-y-1.5">
            <p className="text-h3">{cv.title}</p>
            <p className="text-small text-muted-foreground">{cv.description}</p>
          </div>
          <Badge>{cv.meta}</Badge>
          <AssetActions asset={cv} />
          <p className="text-small text-muted-foreground">
            The CV is written in German for applications in Austria. It covers NexusOS, the Pentest Report Generator
            and Ghost Protocol, education at the Université de Strasbourg and LISAA, and languages (English C2, French
            C2, Arabic fluent, German B1, Swedish A2).
          </p>
        </Card>
      </div>
    </Section>
  );
}
