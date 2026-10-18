import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { otherProjects } from "~/data/profile";
import { Section } from "~/sections/Section";

export function ProjectsSection() {
  return (
    <Section
      id="projects"
      title="Other projects"
      subtitle="Personal, self-directed projects listed in the CV — not employment as a developer."
    >
      <div className="grid gap-3 md:grid-cols-2">
        {otherProjects.map((p) => (
          <Card key={p.name} className="space-y-2 p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-h4">{p.name}</p>
              <Badge>Personal</Badge>
            </div>
            <p className="text-small leading-relaxed text-muted-foreground">{p.detail}</p>
          </Card>
        ))}
      </div>
    </Section>
  );
}
