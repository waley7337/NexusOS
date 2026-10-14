/**
 * Tasks workspace — cross-project task board (Part 08.4).
 */
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { CheckSquare, Plus, Search } from "lucide-react";
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
  TASK_PRIORITIES, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, TASK_STATUSES,
  type Task, type TaskCreatePayload, type TaskPriority, type TaskStatus,
} from "../types";
import {
  useCreateTask, useDeleteTask, useTasks, useUpdateTask, useProjects,
} from "../hooks/useProjects";

const PAGE_SIZE = 20;

const errorMessage = (error: unknown) =>
  error instanceof ApiRequestError ? error.message : "Could not complete this request.";

function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const variants: Record<TaskStatus, "default" | "warning" | "success" | "danger" | "info" | "accent"> = {
    backlog: "default",
    todo: "info",
    in_progress: "accent",
    in_review: "warning",
    done: "success",
    canceled: "danger",
  };
  return <Badge variant={variants[status]}>{TASK_STATUS_LABELS[status]}</Badge>;
}

interface TaskFormProps {
  initial?: Partial<Task>;
  onSubmit: (values: TaskCreatePayload) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}

function TaskForm({ initial, onSubmit, onCancel, loading }: TaskFormProps) {
  const { data: projectsData } = useProjects({ pageSize: 100, status: "active" });
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [projectId, setProjectId] = useState(initial?.projectId ?? "");
  const [status, setStatus] = useState<TaskStatus>(initial?.status ?? "todo");
  const [priority, setPriority] = useState<TaskPriority>(initial?.priority ?? "medium");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !projectId) return;
    await onSubmit({
      title: title.trim(),
      description: description || null,
      projectId,
      status,
      priority,
      dueDate: dueDate || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Project *</label>
        <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} required>
          <option value="">Select project…</option>
          {projectsData?.items.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Title *</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Description</label>
        <textarea
          className="rounded-control border border-line-soft bg-surface-0 px-3 py-2 text-sm resize-none h-20 focus:outline-hidden focus:ring-1 focus:ring-ring"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
        />
      </div>
      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-1.5">
          <label className="text-sm font-medium">Status</label>
          <Select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>
            ))}
          </Select>
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <label className="text-sm font-medium">Priority</label>
          <Select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</option>
            ))}
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Due Date</label>
        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button type="submit" disabled={loading || !title.trim() || !projectId}>
          {loading ? "Saving…" : (initial?.id ? "Update" : "Create")}
        </Button>
      </div>
    </form>
  );
}

export function TasksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get("page") ?? 1);
  const rawSearch = searchParams.get("search") ?? "";
  const statusFilter = (searchParams.get("status") ?? "") as TaskStatus | "";

  const debouncedSearch = useDebounce(rawSearch, 350);

  const params = {
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
  };

  const { data, isLoading, isError, error } = useTasks(params);
  const createMutation = useCreateTask();
  const deleteMutation = useDeleteTask();

  const [drawerMode, setDrawerMode] = useState<"create" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<Task | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

  const updateMutation = useUpdateTask(editTarget?.id ?? "");

  function openCreate() { setDrawerMode("create"); setEditTarget(null); }
  function openEdit(t: Task) { setEditTarget(t); setDrawerMode("edit"); }
  function closeDrawer() { setDrawerMode(null); setEditTarget(null); }

  async function handleCreate(payload: TaskCreatePayload) {
    try {
      await createMutation.mutateAsync(payload);
      toast.success("Task created.");
      closeDrawer();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function handleUpdate(payload: TaskCreatePayload) {
    if (!editTarget) return;
    try {
      await updateMutation.mutateAsync(payload);
      toast.success("Task updated.");
      closeDrawer();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success("Task deleted.");
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
        title="Tasks"
        description="View and manage tasks across all projects."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> New Task
          </Button>
        }
      />

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search tasks…"
            value={rawSearch}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-control" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState title="Failed to load tasks" description={errorMessage(error)} />
      ) : !data?.items.length ? (
        <EmptyState
          icon={CheckSquare}
          title="No tasks yet"
          description="Create your first task or adjust the filters."
        />
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {data.items.map((task) => (
              <div key={task.id} className="surface flex items-center gap-3 p-3 hover:border-line-strong">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-1">{task.title}</p>
                  {task.description && (
                    <p className="text-small text-muted-foreground line-clamp-1">{task.description}</p>
                  )}
                </div>
                <TaskStatusBadge status={task.status} />
                {task.dueDate && (
                  <span className="text-small text-muted-foreground shrink-0">
                    {new Date(task.dueDate).toLocaleDateString()}
                  </span>
                )}
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(task)}>Edit</Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteTarget(task)}>Delete</Button>
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

      <Drawer open={drawerMode !== null} onOpenChange={(o) => !o && closeDrawer()}>
        <DrawerContent>
          <DrawerHeader title={drawerMode === "edit" ? "Edit Task" : "New Task"} />
          <DrawerBody>
            <TaskForm
              initial={editTarget ?? undefined}
              onSubmit={drawerMode === "edit" ? handleUpdate : handleCreate}
              onCancel={closeDrawer}
              loading={createMutation.isPending || updateMutation.isPending}
            />
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete task?"
        description={`"${deleteTarget?.title ?? ""}" will be permanently deleted.`}
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
