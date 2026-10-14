import { z } from "zod";

const projectName = z
  .string()
  .trim()
  .min(2, "Project name must be at least 2 characters.")
  .max(80, "Project name must be 80 characters or fewer.");

const projectDescription = z
  .string()
  .trim()
  .max(500, "Description must be 500 characters or fewer.")
  .optional();

export const createProjectSchema = z.object({
  name: projectName,
  description: projectDescription.transform(
    (description) => description || undefined,
  ),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

// Strict so archivedAt, slug, or other fields can't be set through an edit. A
// missing or empty description clears it, because the form always sends both.
export const updateProjectSchema = z.strictObject({
  name: projectName,
  description: projectDescription.transform(
    (description) => description || null,
  ),
});

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
