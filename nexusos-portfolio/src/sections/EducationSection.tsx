import { GraduationCap, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Row, RowGroup } from "@/components/ui/structure";
import { degree } from "~/data/assets";
import { education } from "~/data/profile";
import { AssetActions } from "~/components/AssetPreviewDialog";
import { DocumentPreview } from "~/components/DocumentPreview";
import { Section } from "~/sections/Section";

export function EducationSection() {
  const published = degree.status === "published";
  return (
    <Section id="education" title="Education" subtitle="As stated on the degree certificate.">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="p-6">
          <div className="flex items-start gap-3">
            <GraduationCap className="mt-1 h-[var(--icon-md)] w-[var(--icon-md)] shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0 space-y-1.5">
              <p className="eyebrow">{education.institution}</p>
              <h3 className="text-h2">
                {education.degree} — {education.field}
              </h3>
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant="accent">{education.honours}</Badge>
                <Badge>Année universitaire {education.academicYear}</Badge>
                <Badge>Awarded {education.awarded}</Badge>
              </div>
            </div>
          </div>
          <RowGroup className="mt-6 border-t border-line-soft">
            <Row register="CV wording">
              <p className="text-sm">{education.cvWording}</p>
            </Row>
            <Row register={education.further.years}>
              <p className="text-sm">{education.further.institution}</p>
              <p className="text-small text-muted-foreground">{education.further.detail} (from the CV)</p>
            </Row>
          </RowGroup>
        </Card>

        {published ? (
          <div className="space-y-3">
            <DocumentPreview asset={degree} />
            <AssetActions asset={degree} />
          </div>
        ) : (
          <Card className="flex h-fit flex-col gap-3 border-dashed p-6" data-testid="degree-on-request">
            <Lock className="h-[var(--icon-md)] w-[var(--icon-md)] text-muted-foreground" aria-hidden="true" />
            <p className="text-h4">Degree certificate — available on request</p>
            <p className="text-small text-muted-foreground">{degree.note}</p>
            <AssetActions asset={degree} />
          </Card>
        )}
      </div>
    </Section>
  );
}
