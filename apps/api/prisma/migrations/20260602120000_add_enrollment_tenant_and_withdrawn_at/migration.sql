-- AlterTable
ALTER TABLE "enrollments" ADD COLUMN "institutionId" TEXT;
ALTER TABLE "enrollments" ADD COLUMN "withdrawnAt" TIMESTAMP(3);

-- DataMigration
UPDATE "enrollments" e
SET "institutionId" = s."institutionId"
FROM "students" s
WHERE e."studentId" = s."id";

-- Enforce tenant ownership after backfill.
ALTER TABLE "enrollments" ALTER COLUMN "institutionId" SET NOT NULL;
