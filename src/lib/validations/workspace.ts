import { z } from "zod";

export const createWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Workspace name must be at least 2 characters.")
    .max(50, "Workspace name must be 50 characters or fewer."),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const renameWorkspaceSchema = z.strictObject(createWorkspaceSchema.shape);

export type RenameWorkspaceInput = z.infer<typeof renameWorkspaceSchema>;
