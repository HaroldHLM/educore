/*
  Warnings:

  - The values [FREE] on the enum `Plan` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Plan_new" AS ENUM ('BASE', 'INTERMEDIO', 'PRO', 'ENTERPRISE');
ALTER TABLE "public"."institutions" ALTER COLUMN "plan" DROP DEFAULT;
ALTER TABLE "institutions" ALTER COLUMN "plan" TYPE "Plan_new" USING ("plan"::text::"Plan_new");
ALTER TYPE "Plan" RENAME TO "Plan_old";
ALTER TYPE "Plan_new" RENAME TO "Plan";
DROP TYPE "public"."Plan_old";
ALTER TABLE "institutions" ALTER COLUMN "plan" SET DEFAULT 'BASE';
COMMIT;

-- AlterTable
ALTER TABLE "institutions" ALTER COLUMN "plan" SET DEFAULT 'BASE';
