# Academic Refactor Validation

## Domain Boundary

- `Course` = classroom / grade / section / academic year.
- `Subject` = academic subject / matter.
- Course display value is computed by API as `displayName = "${grade} ${section} - ${year}"`.
- `Course.name` is legacy and optional. New clients should not depend on it.

## Prisma Migration Checks

Run before applying unique indexes in a non-empty database:

```sql
SELECT "institutionId", grade, section, year, COUNT(*)
FROM courses
GROUP BY "institutionId", grade, section, year
HAVING COUNT(*) > 1;

SELECT "courseId", name, COUNT(*)
FROM subjects
GROUP BY "courseId", name
HAVING COUNT(*) > 1;
```

Expected: both return zero rows.

Required migrations:

- `20260526150135_add_subject_teacher_relation`
- `20260526162000_add_subject_is_active`
- `20260526170000_refactor_course_as_classroom`
- `20260526173000_add_subject_course_name_unique`
- `20260526174000_clear_legacy_course_name`

## Endpoint Checklist

### Courses

- `POST /api/courses`
  - Valid: `{ "grade": "5to", "section": "A", "year": 2026 }`
  - Invalid duplicate: same `grade + section + year` in same institution.
  - Invalid year: less than 2000 or greater than 2100.
  - `name` is optional and legacy.
- `GET /api/courses`
  - Validate `displayName`.
  - Validate pagination metadata.
  - Validate search by grade, section, year.
- `GET /api/courses/:id`
  - Validate tenant isolation.
  - Validate `displayName`.
- `PATCH /api/courses/:id`
  - Validate duplicate conflict on target `grade + section + year`.
- `DELETE /api/courses/:id`
  - Valid only when course has no enrollments and no subjects.
  - Conflict when relations exist.

### Subjects

- `POST /api/subjects`
  - Valid: subject name as matter, e.g. `Matemática`.
  - Invalid duplicate: same `name` in same `courseId`.
  - Invalid `courseId` from another tenant.
  - Invalid `teacherId` from another tenant.
  - Invalid `credits <= 0`.
  - Invalid `weight <= 0`.
- `GET /api/subjects`
  - Validate `course.displayName`.
  - Validate optional teacher.
  - Validate `isActive`.
  - Validate teacher self-access.
- `GET /api/subjects/:id`
  - Validate `course.displayName`.
  - Validate teacher self-access.
- `PATCH /api/subjects/:id`
  - Validate reactivation with `{ "isActive": true }`.
  - Validate duplicate name when moving to another course.
- `PATCH /api/subjects/:id/teacher`
  - Assign teacher with `{ "teacherId": "..." }`.
  - Remove teacher with `{ "teacherId": null }`.

### Teachers

- `GET /api/teachers`
  - Validate assigned courses return `displayName`, not `name`.
- `POST /api/teachers/:id/courses`
  - Validate course belongs to same tenant.
  - Validate duplicate course IDs are rejected.

### Grades

There is currently no REST `grades` module in `apps/api/src/modules`.

Prisma constraint to validate when a grades module is added:

- `@@unique([studentId, subjectId, periodId])`

Expected behavior:

- One grade per student, subject and period.
- Duplicate create should return conflict.
- `student`, `subject`, and `period` must belong to the same tenant.

## REST Collection

Import:

```txt
apps/api/docs/academic-refactor.postman_collection.json
```

Set variables:

- `baseUrl`
- `accessToken`
- `institutionSlug`
- `courseId`
- `subjectId`
- `teacherId`

## Commands

```bash
cd apps/api
npx prisma validate
npx prisma migrate status
npx prisma migrate dev
npx prisma db seed
pnpm build
pnpm lint
```

## Frontend Breaking Changes

- `CourseResponse.name` is now `string | null`.
- Use `CourseResponse.displayName` for UI labels.
- Teacher assigned course responses now expose `displayName` instead of `name`.
- Subject course responses now expose `course.displayName` instead of `course.name`.
- Course creation no longer requires `name`.
- Course duplicate rule is now `institutionId + grade + section + year`.
