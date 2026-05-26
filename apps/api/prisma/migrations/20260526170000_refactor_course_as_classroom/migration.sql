-- AlterTable
ALTER TABLE "courses" ALTER COLUMN "name" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "courses_institutionId_grade_section_year_key" ON "courses"("institutionId", "grade", "section", "year");
