# Atlas Learning Platform — Agent Guide

## Project context

Atlas is a private school e-learning platform. Atlas administrators create schools, invite headteachers, and manage the course catalog. Headteachers manage their school teachers and view school analytics. Teachers and headteachers consume assigned video courses with progress tracking. Instructors create and maintain only the courses they personally own.

## Stack and commands

- Next.js App Router with TypeScript and React.
- Prisma ORM with PostgreSQL.
- Auth.js credentials authentication with bcrypt password hashes.
- Tailwind is available, but much of the current UI uses `src/app/prototype.css` and shared shell styles.
- Mux is used for video playback.

Useful commands:

```powershell
npm run dev
npx tsc --noEmit
npm run test
npx prisma migrate deploy
npx prisma generate
```

Always use the normal `npx prisma generate` command. Do not use `npx prisma generate --no-engine`; this project uses a normal PostgreSQL `DATABASE_URL`, and the engine-less client causes `P6001` runtime failures that can appear in the UI as “Course not found.” If Prisma files are locked, stop the Atlas Next.js development process, run the normal generate command, and restart the server.

## Authentication and roles

Roles are defined in `prisma/schema.prisma`:

- `ATLAS_ADMIN`: full platform administration.
- `INSTRUCTOR`: creates and edits only courses where `Course.createdById` is their user ID.
- `HEADTEACHER`: manages teachers and analytics for their school.
- `TEACHER`: consumes assigned courses and tracks personal progress.

Use the access helpers in `src/lib/access.ts` rather than duplicating role checks:

- `requireAtlasAdmin()` for Atlas-wide administration.
- `requireSchoolManager()` for headteacher or Atlas Admin school operations.
- `requireHeadteacher()` for headteacher-only operations.
- `requireCourseEditor()` for Atlas Admin or Instructor access to the course area.
- `requireOwnedCourseEditor(courseId)` for course-specific edit, preview, delete, module/lesson, and resource operations. Atlas Admins may access all courses; instructors may access only their own.

Do not rely only on hidden buttons or client-side redirects for authorization. Every relevant API route must enforce permissions server-side.

## Navigation conventions

Atlas Admin sidebar:

- Overview: `/admin`
- School management: `/admin/schools`
- Course management: `/admin/courses`
- Users: `/admin/users`
- Analytics: `/admin/analytics`
- Account: `/settings`, `/help`

Instructor sidebar:

- Overview: `/admin`
- Course management: `/admin/courses`
- Account: `/settings`, `/help`

Instructor settings must continue to use the instructor workspace navigation. Do not replace it with the learner navigation (`Dashboard`, `My learning`, and Course management).

Headteacher and teacher navigation should remain unchanged unless the task explicitly requests a change.

Use `AdminShell` for Atlas Admin and Instructor workspace pages. Use `AuthShell` for headteacher and teacher pages. `AccountShell` selects the appropriate shell for settings and help pages.

## Course management rules

- Courses are visible to all active schools by default.
- School-specific course access is managed from the school profile page under “Courses available to this school.”
- The school course-access UI must support local selection, `Select all`, `Deselect all`, `Save changes`, and `Discard changes`.
- Selection changes must not be persisted until Save is pressed. Discard restores the last saved selection.
- When all courses are selected, remove unnecessary school-course overrides and use the global default.
- Course actions in the course-management table use an accessible dropdown containing Preview, Edit, and (for Atlas Admins) Publish/Unpublish.
- Notes and downloadable resources are optional. Empty notes/resources must never prevent a course from loading.
- Modules and lessons are real persisted course content, not presentation-only templates.
- Instructors create courses as drafts; Atlas Admin publication controls visibility to schools.

Course ownership is stored with `Course.createdById` and the `CourseCreator` relation. Existing courses created before ownership tracking may have a null owner and remain Atlas-managed; do not assign them to an instructor without an explicit product decision.

## Course API safety

Course Edit and Preview must distinguish these cases:

- `404`: the course ID genuinely does not exist.
- `403`: the user is not allowed to access that course.
- `500`: a server or database failure.

Never catch all course-loading errors and render “Course not found.” The client should display the API error so database or authorization problems can be diagnosed.

Optional resources should be loaded independently from the required course record where practical. A missing or empty resource list should resolve to `[]`.

## Database workflow

- Add schema changes to `prisma/schema.prisma`.
- Add a timestamped SQL migration under `prisma/migrations/`.
- Apply with `npx prisma migrate deploy`.
- Regenerate with normal `npx prisma generate`.
- Do not reset or delete the database to solve migration or login issues.

Preserve existing data, especially course progress, analytics history, disabled users, and school records.

## UI and UX conventions

- Preserve the existing Atlas visual language and prototype-inspired layouts.
- Prefer shared components, Lucide icons, semantic controls, visible labels, and clear loading/error/success states.
- Keep primary actions visually prominent and secondary/destructive actions subordinate.
- Ensure dropdowns, buttons, rows, and checkboxes are keyboard accessible with useful labels.
- Avoid changing teacher/headteacher page designs when working on Atlas Admin or Instructor pages.
- Keep sticky sidebar support/sign-out controls visible on desktop layouts.

## Verification before handoff

Run:

```powershell
npx tsc --noEmit
npm run test
```

For authentication or Prisma changes, also verify the configured database connection and test at least one relevant role. For course changes, test Atlas Admin access, instructor own-course access, instructor access denial for another owner’s course, and empty optional notes/resources.

<!-- BEGIN:nextjs-agent-rules -->
This version has breaking changes — APIs, conventions, and file structure may differ from older Next.js versions. Read the relevant guide in `node_modules/next/dist/docs/` before writing code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
