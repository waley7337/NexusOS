import { useState } from "react";
import { Github } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Row, RowGroup } from "@/components/ui/structure";
import { interfaceShots, type Asset } from "~/data/assets";
import { nexusos } from "~/data/nexusos";
import { profile } from "~/data/profile";
import { AssetPreviewDialog } from "~/components/AssetPreviewDialog";
import { Section } from "~/sections/Section";

export function NexusOSSection() {
  const [preview, setPreview] = useState<Asset | null>(null);

  return (
    <Section
      id="nexusos"
      title="NexusOS"
      subtitle="Featured project · multi-tenant business platform"
      action={
        <a className={buttonVariants({ variant: "outline", size: "sm" })} href={profile.repo} target="_blank" rel="noreferrer">
          <Github aria-hidden="true" />
          Repository
        </a>
      }
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <p className="text-h3 font-medium leading-snug">{nexusos.subtitle}</p>
          {nexusos.summary.map((p) => (
            <p key={p.slice(0, 24)} className="text-body text-muted-foreground">
              {p}
            </p>
          ))}
          <p className="text-small text-muted-foreground">
            <span className="text-machine mr-2">Role</span>
            {nexusos.role}
          </p>
        </div>
        <Card className="p-5">
          <p className="eyebrow mb-1">Status — stated precisely</p>
          <RowGroup>
            <Row register={<Badge variant="success">Implemented</Badge>}>
              <p className="text-small text-muted-foreground">{nexusos.status.implemented}</p>
            </Row>
            <Row register={<Badge variant="warning">Prepared</Badge>}>
              <p className="text-small text-muted-foreground">{nexusos.status.prepared}</p>
            </Row>
            <Row register={<Badge>Not built</Badge>}>
              <p className="text-small text-muted-foreground">{nexusos.status.notImplemented}</p>
            </Row>
          </RowGroup>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {nexusos.highlights.map((h) => (
          <Card key={h.title} className="p-5">
            <p className="text-h4">{h.title}</p>
            <p className="mt-2 text-small leading-relaxed text-muted-foreground">{h.body}</p>
          </Card>
        ))}
      </div>

      <div className="space-y-3">
        <p className="eyebrow">Interface</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {interfaceShots.map((shot) => (
            <Card key={shot.id} interactive className="overflow-hidden">
              <button type="button" className="focus-ring block w-full text-left" onClick={() => setPreview(shot)}>
                <img src={shot.preview} alt={shot.title} loading="lazy" className="aspect-[16/10] w-full object-cover" />
                <span className="block p-3 text-sm font-medium">{shot.title}</span>
              </button>
            </Card>
          ))}
        </div>
        <p className="text-small text-muted-foreground">{nexusos.interfaceNote}</p>
      </div>

      <RowGroup className="border-y border-line-soft">
        {nexusos.stack.map((s) => (
          <Row key={s.label} register={s.label}>
            <p className="text-sm">{s.value}</p>
          </Row>
        ))}
      </RowGroup>

      <AssetPreviewDialog asset={preview} onClose={() => setPreview(null)} />
    </Section>
  );
}
