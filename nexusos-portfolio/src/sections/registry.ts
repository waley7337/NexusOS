import type { LucideIcon } from "lucide-react";
import { BookOpen, FileText, FolderOpen, GraduationCap, LayoutDashboard, Mail, Network, Orbit } from "lucide-react";

export interface SectionEntry {
  id: string;
  label: string;
  icon: LucideIcon;
}

export const SECTIONS: SectionEntry[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "nexusos", label: "NexusOS", icon: Orbit },
  { id: "architecture", label: "Architecture", icon: Network },
  { id: "library", label: "Library", icon: FolderOpen },
  { id: "cv", label: "CV", icon: FileText },
  { id: "education", label: "Education", icon: GraduationCap },
  { id: "projects", label: "Other projects", icon: BookOpen },
  { id: "contact", label: "Contact", icon: Mail },
];
