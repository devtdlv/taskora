-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "position" INTEGER;

-- Existing tasks keep the order the board showed them in: oldest first within
-- each project's status column.
UPDATE "tasks" t
SET "position" = ordered.row_number - 1
FROM (
    SELECT "id", ROW_NUMBER() OVER (
        PARTITION BY "projectId", "status"
        ORDER BY "createdAt", "id"
    ) AS row_number
    FROM "tasks"
) ordered
WHERE t."id" = ordered."id";

ALTER TABLE "tasks" ALTER COLUMN "position" SET NOT NULL;

-- CreateIndex
CREATE INDEX "tasks_projectId_status_position_idx" ON "tasks"("projectId", "status", "position");
