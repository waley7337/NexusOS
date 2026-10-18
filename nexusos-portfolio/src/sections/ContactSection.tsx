import { Github, LogIn, Mail, MapPin, Phone } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Row, RowGroup } from "@/components/ui/structure";
import { profile } from "~/data/profile";
import { Section } from "~/sections/Section";

export function ContactSection() {
  return (
    <Section id="contact" title="Contact" subtitle="Looking for an AQUA placement in application development.">
      <Card className="p-6">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <RowGroup>
            <Row marker={<Mail className="h-4 w-4" />} register="Email">
              <a className="focus-ring rounded-control text-sm hover:text-primary" href={`mailto:${profile.email}`}>
                {profile.email}
              </a>
            </Row>
            <Row marker={<Phone className="h-4 w-4" />} register="Phone">
              <a className="focus-ring rounded-control text-sm hover:text-primary" href={`tel:${profile.phone.replace(/\s/g, "")}`}>
                {profile.phone}
              </a>
            </Row>
            <Row marker={<Github className="h-4 w-4" />} register="GitHub">
              <a className="focus-ring rounded-control text-sm hover:text-primary" href={profile.github} target="_blank" rel="noreferrer">
                github.com/waley7337
              </a>
            </Row>
            <Row marker={<LogIn className="h-4 w-4" />} register="Live app">
              <a className="focus-ring rounded-control text-sm hover:text-primary" href={profile.liveApp.url} target="_blank" rel="noreferrer">
                {profile.liveApp.host}/login
              </a>
              <p className="text-small text-muted-foreground">{profile.liveApp.note}</p>
            </Row>
            <Row marker={<MapPin className="h-4 w-4" />} register="Location">
              <p className="text-sm">{profile.location}</p>
              <p className="text-small text-muted-foreground">{profile.availability}</p>
            </Row>
          </RowGroup>
          <a className={buttonVariants({ size: "lg" })} href={`mailto:${profile.email}`}>
            <Mail aria-hidden="true" />
            Get in touch
          </a>
        </div>
      </Card>
      <p className="text-machine text-center">
        Built on the NexusOS design system — tokens, SpaceField and Starfield compiled from the NexusOS frontend
      </p>
    </Section>
  );
}
