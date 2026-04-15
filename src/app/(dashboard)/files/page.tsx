import PageHeader from "@/components/ui/PageHeader";
import FileBrowser from "./FileBrowser";

export default function FilesPage() {
  return (
    <div>
      <PageHeader
        title="Files"
        description="Browse and edit container volumes under /docklet-data/volumes"
      />
      <FileBrowser />
    </div>
  );
}
