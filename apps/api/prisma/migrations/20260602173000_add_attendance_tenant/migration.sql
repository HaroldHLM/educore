-- AlterTable
ALTER TABLE "attendances" ADD COLUMN "institutionId" TEXT;

-- DataMigration
UPDATE "attendances" a
SET "institutionId" = s."institutionId"
FROM "students" s
WHERE a."studentId" = s."id";

-- Enforce tenant ownership after backfill.
ALTER TABLE "attendances" ALTER COLUMN "institutionId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "attendances_institutionId_idx" ON "attendances"("institutionId");

-- CreateIndex
CREATE INDEX "attendances_periodId_idx" ON "attendances"("periodId");
