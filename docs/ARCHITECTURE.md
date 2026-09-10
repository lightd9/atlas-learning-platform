41# Architecture

## System shape

Atlas is a single Next.js application. The App Router renders public pages, authenticated workspaces, and server-backed API route handlers from one deployment. There is no separate API service.

```text
Browser
  -> Next middleware (security headers + page session gate)
  -> App Router page or /api route
  -> access helper + validation
  -> Prisma client
  -> PostgreSQL

Course editor -> Mux Direct Upload (browser PUT)
Mux -> signed webhook -> Atlas lesson/upload state
Learner -> Atlas playback route -> signed Mux HLS URL
```

## Application boundaries

- `src/app/**/page.tsx`: route-level UI and workspace composition.
- `src/app/api/**/route.ts`: HTTP boundary. Parse input, enforce authorization, perform the smallest transaction needed, and return an explicit status.
- `src/lib/access.ts`: canonical identity, role, ownership, school-access, and publication checks.
- `src/lib/prisma.ts`: one Prisma client in development; direct PostgreSQL in production.
- `src/lib/mux.ts`: Mux API calls, JWT signing, webhook verification, and thumbnail URLs.
- `src/lib/email.ts`: provider integration with a development fallback.
- `src/lib/audit.ts` and `src/lib/rate-limit.ts`: cross-cutting persistence concerns.

## Identity and authorization

Auth.js uses credentials plus bcrypt comparison. Successful authorization places `id`, `role`, `schoolId`, name, and email in a JWT session. `requireSchoolUser()` reloads the user from PostgreSQL, so disabled accounts are rejected even when an older JWT exists.

Use these checks in API handlers:

| Helper | Contract |
| --- | --- |
| `requireAtlasAdmin` | Active `ATLAS_ADMIN` |
| `requireSchoolManager` | Active `HEADTEACHER` or `ATLAS_ADMIN` |
| `requireHeadteacher` | Active `HEADTEACHER` |
| `requireCourseEditor` | Active `ATLAS_ADMIN` or `INSTRUCTOR` |
| `requireOwnedCourseEditor(courseId)` | Admin: any course; instructor: own course only |
| `requireAvailableCourse(user, courseId)` | Existing, published course allowed for the user's school |

Client-side hidden controls are convenience only. A route that mutates data must enforce the same rule on the server and return `401`, `403`, or `404` distinctly.

## Core data model

`School` owns users, invitations, audit entries, and explicit `SchoolCourse` access overrides. `User` has one platform role and optional school membership. `Course` may have a nullable `createdById` for legacy Atlas-managed content, belongs to an optional section, and cascades to resources, modules, lessons, progress, and school overrides. `CourseModule` and `Lesson` are persisted content, not UI templates. `MuxUpload` and `MuxAsset` model asynchronous video state. `CourseProgress` and `LessonProgress` store learner state; `AuditLog`, `EmailDelivery`, and `RateLimitBucket` support operations and security.

The global course policy is “published courses are available to active schools.” A `SchoolCourse` row with `enabled: false` denies access; selecting every school removes unnecessary overrides and restores the global default.

## Important request flows

### Course editing

1. The route calls `requireOwnedCourseEditor`.
2. Zod/input checks validate fields and ownership of nested module/lesson/resource IDs.
3. Prisma updates the course in a transaction where multiple records must remain consistent.
4. Mutations write an audit entry where the action is operationally meaningful.

Instructors always create drafts. Only Atlas Admins can publish or unpublish.

### Video upload

Atlas creates a Mux Direct Upload and stores a local `MuxUpload` lifecycle record. The browser uploads directly to Mux. Signed webhook events update upload and asset status; `video.asset.ready` stores the playback ID and duration on the lesson. Learners receive short-lived signed HLS URLs only after publication and school-access checks.

### Progress

The progress endpoint accepts course/lesson progress and watched ranges (maximum 500 ranges). Progress is user-scoped and should be treated as idempotent for repeated client saves. Optional notes/resources must resolve to an empty collection rather than making course loading fail.

## Error semantics

Use `apiErrorResponse` for known access failures. A missing record is `404`, an unauthorized record is `403`, and an infrastructure/database failure is `500` (Mux upstream failures may be `502`/`503`). Do not convert all course-loading exceptions into “Course not found.”
