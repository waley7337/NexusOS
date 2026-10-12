import { Hero } from "~/sections/Hero";
import { NexusOSSection } from "~/sections/NexusOSSection";
import { ArchitectureSection } from "~/sections/ArchitectureSection";
import { LibrarySection } from "~/sections/LibrarySection";
import { CvSection } from "~/sections/CvSection";
import { EducationSection } from "~/sections/EducationSection";
import { ProjectsSection } from "~/sections/ProjectsSection";
import { ContactSection } from "~/sections/ContactSection";

export function Portfolio() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-20 px-5 pb-16 pt-8 sm:px-8 lg:px-10 lg:pt-12">
      <Hero />
      <NexusOSSection />
      <ArchitectureSection />
      <LibrarySection />
      <CvSection />
      <EducationSection />
      <ProjectsSection />
      <ContactSection />
    </div>
  );
}
