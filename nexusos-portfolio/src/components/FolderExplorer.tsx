/**
 * Folder-style library. Folders → files → preview. Everything is driven by
 * data/assets.ts, so a new folder or file appears here without UI changes.
 */
import { useState } from "react";
import { ChevronRight, FileText, Folder as FolderIcon, FolderOpen, Image as ImageIcon, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Ticks } from "@/components/ui/structure";
import { useSpotlight } from "@/hooks/useSpotlight";
import type { Asset, Folder } from "~/data/assets";
import { AssetPreviewDialog } from "~/components/AssetPreviewDialog";

export function FolderExplorer({ folders }: { folders: Folder[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Asset | null>(null);
  const open = folders.find((f) => f.id === openId) ?? null;
  const groups = [...new Set(folders.map((f) => f.group))];

  return (
    <div className="space-y-5" data-testid="folder-explorer">
      <nav aria-label="Library location" className="text-machine flex items-center gap-1.5">
        <button
          type="button"
          className="focus-ring rounded-control px-1 hover:text-foreground disabled:hover:text-muted-foreground"
          onClick={() => setOpenId(null)}
          disabled={!open}
        >
          Library
        </button>
        {open && (
          <>
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
            <span className="text-foreground">{open.group}</span>
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
            <span className="text-foreground" aria-current="page">
              {open.label}
            </span>
          </>
        )}
      </nav>

      {open ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <FolderOpen className="h-[var(--icon-md)] w-[var(--icon-md)] text-primary" aria-hidden="true" />
              <div>
                <h3 className="text-h3">{open.label}</h3>
                <p className="text-small text-muted-foreground">{open.description}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setOpenId(null)}>
              Back to library
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {open.assets.map((asset) => (
              <AssetTile key={asset.id} asset={asset} onOpen={() => setPreview(asset)} />
            ))}
          </div>
        </div>
      ) : (
        groups.map((group) => (
          <div key={group} className="space-y-3">
            <p className="eyebrow">{group}</p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {folders
                .filter((f) => f.group === group)
                .map((folder) => (
                  <FolderTile key={folder.id} folder={folder} onOpen={() => setOpenId(folder.id)} />
                ))}
            </div>
          </div>
        ))
      )}

      <AssetPreviewDialog asset={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

function FolderTile({ folder, onOpen }: { folder: Folder; onOpen: () => void }) {
  const ref = useSpotlight<HTMLButtonElement>();
  const published = folder.assets.filter((a) => a.status === "published").length;
  return (
    <button
      ref={ref}
      type="button"
      onClick={onOpen}
      className="surface card-lift spotlight focus-edge group relative flex w-full flex-col gap-3 p-4 text-left"
      data-folder={folder.id}
    >
      <Ticks />
      <span className="flex items-center justify-between">
        <FolderIcon
          className="h-[var(--icon-md)] w-[var(--icon-md)] text-muted-foreground transition-colors duration-fast group-hover:text-primary"
          aria-hidden="true"
        />
        <span className="text-machine num">
          {folder.assets.length} {folder.assets.length === 1 ? "item" : "items"}
        </span>
      </span>
      <span>
        <span className="block text-h4">{folder.label}</span>
        <span className="mt-0.5 block text-small text-muted-foreground">{folder.description}</span>
      </span>
      {published < folder.assets.length && (
        <span className="text-machine flex items-center gap-1.5">
          <Lock className="h-3 w-3" aria-hidden="true" /> on request
        </span>
      )}
    </button>
  );
}

function AssetTile({ asset, onOpen }: { asset: Asset; onOpen: () => void }) {
  const Icon = asset.status === "withheld" ? Lock : asset.kind === "image" ? ImageIcon : FileText;
  return (
    <Card interactive className="overflow-hidden">
      <button type="button" onClick={onOpen} className="focus-ring block w-full text-left" data-asset={asset.id}>
        <div className="aspect-[16/10] overflow-hidden border-b border-line-soft bg-surface-1">
          {asset.preview && asset.status === "published" && !asset.notice ? (
            <img
              src={asset.preview}
              alt=""
              loading="lazy"
              className={asset.kind === "pdf" ? "h-full w-full object-cover object-top" : "h-full w-full object-cover"}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Icon className="h-6 w-6 text-disabled-foreground" aria-hidden="true" />
            </div>
          )}
        </div>
        <div className="space-y-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <span className="text-h4">{asset.title}</span>
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </div>
          <p className="line-clamp-2 text-small text-muted-foreground">{asset.description}</p>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant={asset.status === "withheld" ? "warning" : "default"}>
              {asset.status === "withheld" ? "On request" : asset.meta}
            </Badge>
            {asset.label && <Badge variant={asset.notice ? "warning" : "accent"}>{asset.label}</Badge>}
          </div>
          {asset.notice && <p className="text-small text-muted-foreground">{asset.notice}</p>}
        </div>
      </button>
    </Card>
  );
}
