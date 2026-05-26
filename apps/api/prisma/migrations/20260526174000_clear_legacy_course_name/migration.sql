-- DataMigration
-- Course now represents classroom/grade-section-year. Subject owns academic names.
UPDATE "courses" SET "name" = NULL WHERE "name" IS NOT NULL;
