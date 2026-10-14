import { useState } from "react";
import { toast } from "sonner";
import { StickyNote } from "lucide-react";
import { Can } from "@/components/can";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/dialog";
import { ApiRequestError } from "@/api/client";
import {
  useArchiveCustomerNote,
  useCreateCustomerNote,
  useCustomerNotes,
} from "../hooks/useCustomerNotes";
import { customerNoteSchema } from "../schemas/customerNoteSchema";
import type { CustomerNote } from "../types";

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

interface CustomerNotesSectionProps {
  customerId: string;
}

export function CustomerNotesSection({ customerId }: CustomerNotesSectionProps) {
  const [draft, setDraft] = useState("");
  const [archiveTarget, setArchiveTarget] = useState<CustomerNote | null>(null);

  const notesQuery = useCustomerNotes(customerId, { sortBy: "created_at", sortDesc: true });
  const createNote = useCreateCustomerNote(customerId);
  const archiveNote = useArchiveCustomerNote(customerId);

  async function handleAddNote() {
    const parsed = customerNoteSchema.safeParse({ content: draft });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid note");
      return;
    }
    try {
      await createNote.mutateAsync({ content: parsed.data.content });
      setDraft("");
      toast.success("Note added");
    } catch (error) {
      const message =
        error instanceof ApiRequestError ? error.message : "Could not add note";
      toast.error(message);
    }
  }

  async function handleArchiveConfirm() {
    if (!archiveTarget) return;
    try {
      await archiveNote.mutateAsync(archiveTarget.id);
      toast.success("Note archived");
      setArchiveTarget(null);
    } catch (error) {
      const message =
        error instanceof ApiRequestError ? error.message : "Could not archive note";
      toast.error(message);
    }
  }

  return (
    <section aria-labelledby="customer-timeline-notes">
      <h4
        id="customer-timeline-notes"
        className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        Timeline notes
      </h4>
      <p className="mb-3 text-2xs text-muted-foreground">
        Append-only notes for this customer. Distinct from the profile notes field on the record.
      </p>

      <Can permission="customers.update">
        <div className="mb-4 space-y-2">
          <label htmlFor="customer-note-draft" className="sr-only">
            New note
          </label>
          <textarea
            id="customer-note-draft"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            placeholder="Add a note about this customer…"
            className="w-full rounded-md border border-line-soft bg-surface-raised px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => void handleAddNote()}
              disabled={createNote.isPending || draft.trim().length === 0}
            >
              {createNote.isPending ? "Adding…" : "Add note"}
            </Button>
          </div>
        </div>
      </Can>

      {notesQuery.isPending ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading notes">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : notesQuery.isError ? (
        <ErrorState
          title="Notes unavailable"
          description="We couldn't load notes for this customer."
          onRetry={() => void notesQuery.refetch()}
        />
      ) : notesQuery.data?.items.length === 0 ? (
        <EmptyState
          icon={StickyNote}
          status="No notes"
          title="No notes yet"
          description="Add the first timeline note for this customer."
        />
      ) : (
        <ul className="space-y-3">
          {notesQuery.data?.items.map((note) => (
            <li
              key={note.id}
              className="rounded-md border border-line-soft bg-surface-raised px-3 py-2.5"
            >
              <p className="whitespace-pre-wrap text-sm text-foreground">{note.content}</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-2xs text-muted-foreground">
                <span>{formatDateTime(note.createdAt)}</span>
                <Can permission="customers.delete">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-danger hover:text-danger"
                    onClick={() => setArchiveTarget(note)}
                  >
                    Archive
                  </Button>
                </Can>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={archiveTarget != null}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(null);
        }}
        title="Archive note?"
        description="This note will be removed from the timeline. This action can be reversed only by an administrator."
        confirmLabel="Archive"
        destructive
        loading={archiveNote.isPending}
        onConfirm={() => void handleArchiveConfirm()}
      />
    </section>
  );
}
