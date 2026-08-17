import { z } from "zod";

export const customerNoteSchema = z.object({
  content: z.string().trim().min(1, "Note content is required"),
});

export type CustomerNoteFormValues = z.infer<typeof customerNoteSchema>;
