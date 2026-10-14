/**
 * Projects workspace — list and manage projects (Part 08.4).
 */
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { FolderKanban, Plus, Search } from "lucide-react";
import { ApiRequestError } from "@/api/client";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmDialog } from "@/components/ui/dialog";
import {
  Drawer, DrawerBody, DrawerContent, DrawerHeader,
} from "@/components/ui/drawer";
import { useDebounce } from "@/hooks/useDebounce";
import { Badge } from "@/components/ui/badge";
import {
  PROJECT_STATUS_LABELS, PROJECT_STATUSES,
  type Project, type ProjectCreatePayload, type ProjectStatus,
} from "../types";
import {
  useCreateProject, useDeleteProject, useProjects, useUpdateProject,
} from "../hooks/useProjects";

const errorMessage = (error: unknown) =>
  error instanceof ApiRequestError ? error.message : "Could not complete this request.";

const PAGE_SIZE = 20;

function StatusBadge({ status }: { status: ProjectStatus }) {
  const variants: Record<ProjectStatus, "default" | "warning" | "success" | "danger" | "info" | "accent"> = {
    planned: "info",
    active: "success",
    on_hold: "warning",
    completed: "accent",
    archived: "danger",
  };
  return <Badge variant={variants[status]}>{PROJECT_STATUS_LABELS[status]}</Badge>;
}

interface ProjectFormProps {
  initial?: Partial<Project>;
  onSubmit: (values: ProjectCreatePayload) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}

function ProjectForm({ initial, onSubmit, onCancel, loading }: ProjectFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState<ProjectStatus>(initial?.status ?? "planned");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await onSubmit({
      name: name.trim(),
      description: description || null,
      status,
      dueDate: dueDate || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Name *</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Description</label>
        <textarea
          className="rounded-control border border-line-soft bg-surface-0 px-3 py-2 text-sm resize-none h-24 focus:outline-hidden focus:ring-1 focus:ring-ring"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Status</label>
        <Select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
          {PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Due Date</label>
        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button type="submit" disabled={loading || !name.trim()}>
          {loading ? "Saving…" : (initial?.id ? "Update" : "Create")}
        </Button>
      </div>
    </form>
  );
}

export function ProjectsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get("page") ?? 1);
  const rawSearch = searchParams.get("search") ?? "";
  const statusFilter = (searchParams.get("status") ?? "") as ProjectStatus | "";

  const debouncedSearch = useDebounce(rawSearch, 350);

  const params = {
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
  };

  const { data, isLoading, isError, error } = useProjects(params);
  const createMutation = useCreateProject();
  const deleteMutation = useDeleteProject();

  const [drawerMode, setDrawerMode] = useState<"create" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  const updateMutation = useUpdateProject(editTarget?.id ?? "");

  function openCreate() { setDrawerMode("create"); setEditTarget(null); }
  function openEdit(p: Project) { setEditTarget(p); setDrawerMode("edit"); }
  function closeDrawer() { setDrawerMode(null); setEditTarget(null); }

  async function handleCreate(payload: ProjectCreatePayload) {
    try {
      await createMutation.mutateAsync(payload);
      toast.success("Project created.");
      closeDrawer();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function handleUpdate(payload: ProjectCreatePayload) {
    if (!editTarget) return;
    try {
      await updateMutation.mutateAsync(payload);
      toast.success("Project updated.");
      closeDrawer();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success("Project deleted.");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  function setPage(p: number) {
    setSearchParams((prev) => { prev.set("page", String(p)); return prev; });
  }

  function setSearch(s: string) {
    setSearchParams((prev) => { prev.set("search", s); prev.set("page", "1"); return prev; });
  }

  function setStatus(s: string) {
    setSearchParams((prev) => { prev.set("status", s); prev.set("page", "1"); return prev; });
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Projects"
        description="Manage your team's projects."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> New Project
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search projects…"
            value={rawSearch}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>
          ))}
        </Select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-control" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState title="Failed to load projects" description={errorMessage(error)} />
      ) : !data?.items.length ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Create your first project to get started."
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((project) => (
              <div
                key={project.id}
                className="surface group flex flex-col gap-2 p-4 transition-colors hover:border-line-strong"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-sm line-clamp-1">{project.name}</span>
                  <StatusBadge status={project.status} />
                </div>
                {project.description && (
                  <p className="text-small text-muted-foreground line-clamp-2">{project.description}</p>
                )}
                {project.dueDate && (
                  <p className="text-small text-muted-foreground">Due: {new Date(project.dueDate).toLocaleDateString()}</p>
                )}
                <div className="flex gap-2 mt-auto pt-2 border-t border-line-soft">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(project)}>Edit</Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteTarget(project)}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
          <Pagination
            page={page}
            totalPages={data.meta.totalPages}
            onPageChange={setPage}
          />
        </>
      )}

      {/* Create/Edit Drawer */}
      <Drawer open={drawerMode !== null} onOpenChange={(o) => !o && closeDrawer()}>
        <DrawerContent>
          <DrawerHeader title={drawerMode === "edit" ? "Edit Project" : "New Project"} />
          <DrawerBody>
            <ProjectForm
              initial={editTarget ?? undefined}
              onSubmit={drawerMode === "edit" ? handleUpdate : handleCreate}
              onCancel={closeDrawer}
              loading={createMutation.isPending || updateMutation.isPending}
            />
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete project?"
        description={`"${deleteTarget?.name ?? ""}" and all its data will be permanently removed.`}
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
