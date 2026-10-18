import { folders } from "~/data/assets";
import { FolderExplorer } from "~/components/FolderExplorer";
import { Section } from "~/sections/Section";

export function LibrarySection() {
  return (
    <Section
      id="library"
      title="Library"
      subtitle="Every document and image behind this portfolio, organised in folders. Open a folder, then a file to preview it."
    >
      <FolderExplorer folders={folders} />
    </Section>
  );
}
