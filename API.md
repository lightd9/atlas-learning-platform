# Atlas Learning Platform API Reference

This document describes the HTTP API implemented under `src/app/api`. The API is part of the Next.js application and uses JSON unless noted otherwise.

## Conventions

- Base URL: the deployed Atlas origin, for example `https://atlas.example.com`.
- Authentication: Auth.js credentials session cookie. Browser requests should use the same origin and include cookies.
- Dynamic identifiers such as `id`, `courseId`, `lessonId`, and `playbackId` are strings.
- Successful responses are JSON unless the endpoint returns a file or redirect.
- Validation failures usually return `400` with `{ "error": string }`.
- Authentication and authorization failures return `401` or `403`.
- Missing records return `404`; conflicts such as duplicate slugs return `409`.
- Unexpected server or database failures return `500`. Mux configuration/upstream failures may return `502` or `503`.

## Roles and access helpers

| Access level | Roles |
| --- | --- |
| Authenticated user | Any active Atlas user |
| School manager | `HEADTEACHER`, or `ATLAS_ADMIN` where supported |
| Headteacher | `HEADTEACHER` only |
| Course editor | `ATLAS_ADMIN`, `INSTRUCTOR` |
| Owned course editor | All courses for `ATLAS_ADMIN`; only courses whose `createdById` matches the instructor |
| Atlas administrator | `ATLAS_ADMIN` only |

Authorization is enforced by the API. Client-side visibility is not considered authorization.

## Authentication and account

### Auth.js handler

`GET|POST /api/auth/[...nextauth]`

Auth.js-managed sign-in, sign-out, session, and CSRF endpoints.

### `POST /api/auth/check-setup-token`

Public. Validates an invitation/setup token.

```json
{ "token": "raw-setup-token" }
```

Returns invitation information when valid.

### `POST /api/auth/setup-password`

Public. Activates an invited account.

```json
{
  "token": "raw-setup-token",
  "name": "User Name",
  "password": "minimum-8-characters"
}
```

### `POST /api/auth/forgot-password`

Public and rate-limited.

```json
{ "email": "user@example.com" }
```

The response intentionally avoids revealing whether the email exists.

### `POST /api/auth/reset-password`

Public and rate-limited.

```json
{
  "email": "user@example.com",
  "token": "reset-token",
  "password": "new-password"
}
```

### `POST /api/auth/resend-invitation`

Public and rate-limited.

```json
{ "email": "invitee@example.com" }
```

### `GET /api/account/profile`

Authenticated. Returns the current user profile.

### `PATCH /api/account/profile`

Authenticated.

```json
{
  "name": "Updated Name",
  "email": "updated@example.com"
}
```

### `PATCH /api/account/password`

Authenticated.

```json
{
  "currentPassword": "current-password",
  "newPassword": "minimum-8-characters"
}
```

## Learner courses and progress

### `GET /api/courses`

Authenticated. Returns published courses available to the user's school, including modules, lessons, progress, and optional resources.

```json
{ "courses": [] }
```

### `GET /api/courses/:id`

Authenticated. Returns one published course after school-access validation. Optional resources resolve to an empty array when unavailable.

### `POST /api/progress`

Authenticated. Saves course or lesson progress.

```json
{
  "courseId": "course-id",
  "lessonId": "lesson-id",
  "watchedSeconds": 120,
  "durationSeconds": 600,
  "watchedRanges": [
    { "start": 0, "end": 75 },
    { "start": 90, "end": 135 }
  ]
}
```

`lessonId` and `watchedRanges` are optional. At most 500 watched ranges are accepted.

## Course administration

### `GET /api/admin/courses`

Course editor. Atlas Admins receive all courses; instructors receive only courses they own.

### `POST /api/admin/courses`

Course editor. Instructors always create drafts regardless of the submitted publication value.

```json
{
  "slug": "course-slug",
  "title": "Course title",
  "description": "Course description",
  "durationMinutes": 30,
  "published": false,
  "sectionId": null,
  "notes": "Optional learner notes",
  "resources": [],
  "modules": [
    {
      "title": "Module 1",
      "description": "Optional description",
      "sortOrder": 0,
      "lessons": [
        {
          "title": "Lesson 1",
          "description": "Optional description",
          "durationSeconds": 300,
          "muxPlaybackId": "optional-playback-id",
          "sortOrder": 0
        }
      ]
    }
  ]
}
```

Resource objects contain `title`, optional `description`, valid `url`, optional `fileName`, and `sortOrder`.

### `GET /api/admin/courses/:id`

Owned course editor. Returns the course, section, resources, school access, and summary counts.

### `PATCH /api/admin/courses/:id`

Owned course editor. Accepts partial course fields:

```json
{
  "title": "Updated title",
  "description": "Updated description",
  "durationMinutes": 45,
  "published": true,
  "muxPlaybackId": null,
  "sectionId": null,
  "notes": "Optional notes"
}
```

Only Atlas Admins may control publication.

### `DELETE /api/admin/courses/:id`

Owned course editor. Deletes the course and its cascading database content.

### `GET /api/admin/courses/:id/content`

Owned course editor. Returns persisted modules and lessons.

### `PUT /api/admin/courses/:id/content`

Owned course editor. Replaces the editable module/lesson structure. Existing IDs must belong to the specified course.

```json
{
  "modules": [
    {
      "id": "optional-existing-module-id",
      "title": "Module title",
      "description": "",
      "sortOrder": 0,
      "lessons": [
        {
          "id": "optional-existing-lesson-id",
          "title": "Lesson title",
          "description": "",
          "durationSeconds": 300,
          "muxPlaybackId": "",
          "sortOrder": 0,
          "published": true
        }
      ]
    }
  ]
}
```

### Course resources

Owned course editor.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/admin/courses/:id/resources` | Add a resource |
| `PATCH` | `/api/admin/courses/:id/resources` | Update a resource; body includes `resourceId` |
| `DELETE` | `/api/admin/courses/:id/resources?resourceId=...` | Delete a resource |

Resource body:

```json
{
  "title": "Worksheet",
  "description": "Optional description",
  "url": "https://example.com/worksheet.pdf",
  "fileName": "worksheet.pdf",
  "sortOrder": 0
}
```

### Course sections

Atlas Admin only.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/admin/course-sections` | List sections |
| `POST` | `/api/admin/course-sections` | Create a section |

```json
{
  "name": "Digital Safety",
  "slug": "digital-safety",
  "description": "Optional description",
  "sortOrder": 0
}
```

## Direct Mux video uploads

All lesson upload endpoints require owned-course access and verify that the lesson belongs to the course.

### `POST /api/admin/courses/:id/lessons/:lessonId/video-upload`

Creates a Mux Direct Upload URL. The browser uploads the file directly to the returned URL with `PUT`.

```json
{
  "filename": "lesson-video.mp4",
  "sizeBytes": 104857600
}
```

Maximum accepted metadata size is 10 GB.

Response:

```json
{
  "uploadId": "atlas-upload-id",
  "muxUploadId": "mux-upload-id",
  "url": "temporary-mux-direct-upload-url"
}
```

### `GET /api/admin/courses/:id/lessons/:lessonId/video-upload`

Returns the latest upload lifecycle record. Status is one of:

`CREATING`, `WAITING`, `PROCESSING`, `READY`, `FAILED`, `CANCELLED`.

### `DELETE /api/admin/courses/:id/lessons/:lessonId/video-upload`

Removes the current video association from the lesson. The underlying Mux asset is retained for recovery.

### `POST /api/mux/webhook`

Mux server-to-server webhook. Requires a valid `mux-signature` header produced with `MUX_WEBHOOK_SECRET`.

Handled lifecycle events include upload creation/processing/cancellation/errors and asset readiness/errors. When an asset becomes ready, Atlas stores its Playback ID on the lesson.

### `GET /api/mux/playback/:playbackId`

Authenticated school user. Verifies course publication and school access, then returns a two-hour signed Mux HLS URL.

```json
{
  "url": "https://stream.mux.com/...m3u8?token=...",
  "courseId": "course-id"
}
```

### `GET /api/mux/thumbnail/course/:courseId`

Authenticated. Selects the first lesson containing a Playback ID and redirects to a signed Mux thumbnail at the one-second frame. Returns `404` when no video is available.

## Schools and course access

### Atlas Admin school endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/admin/schools` | List schools and counts |
| `POST` | `/api/admin/schools` | Create a school and optionally invite its headteacher |
| `GET` | `/api/admin/schools/:id` | Get school details, users, and course access |
| `PATCH` | `/api/admin/schools/:id` | Update school name, slug, or active status |

Create-school body:

```json
{
  "name": "Example School",
  "slug": "example-school",
  "headteacherName": "Headteacher Name",
  "headteacherEmail": "head@example.com"
}
```

The headteacher fields are optional as a pair.

### Atlas Admin course-access endpoints

`POST /api/admin/school-access` accepts either a single override or a full school selection:

```json
{ "schoolId": "school-id", "courseId": "course-id", "enabled": false }
```

```json
{ "schoolId": "school-id", "courseIds": ["course-1", "course-2"] }
```

`PUT /api/admin/school-access` saves the schools that may access one course:

```json
{ "courseId": "course-id", "schoolIds": ["school-1", "school-2"] }
```

Selecting all schools removes unnecessary overrides and restores the global default.

### `POST /api/school-access`

School manager. Updates one school/course access record:

```json
{
  "courseId": "course-id",
  "schoolId": "school-id",
  "enabled": true
}
```

Headteachers may only manage their own school.

### School workspace

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/school` | Authenticated | Current user's school summary |
| `GET` | `/api/school/teachers` | School manager | Teachers in the managed school |
| `GET` | `/api/school/analytics` | Headteacher | School learning analytics |

## Users and invitations

### Atlas Admin users

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/admin/users` | List users |
| `POST` | `/api/admin/users` | Invite an Atlas Admin, Instructor, or Headteacher |
| `PATCH` | `/api/admin/users/:id` | Set status to `ACTIVE` or `DISABLED` |

Invitation body:

```json
{
  "name": "User Name",
  "email": "user@example.com",
  "role": "INSTRUCTOR",
  "schoolId": "required-for-headteacher"
}
```

### General invitations

School manager; Atlas Admins may target a school, while headteachers are scoped to their own school.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/invitations` | List invitations |
| `POST` | `/api/invitations` | Create 1–500 invitations |
| `POST` | `/api/invitations/:id` | Resend an invitation |
| `DELETE` | `/api/invitations/:id` | Revoke an invitation |
| `POST` | `/api/invitations/import-csv` | Import teacher invitations from CSV |
| `GET` | `/api/invitations/template` | Download the CSV template |

Create body:

```json
{
  "schoolId": "school-id",
  "role": "TEACHER",
  "invitations": [
    { "name": "Teacher Name", "email": "teacher@example.com" }
  ]
}
```

CSV import uses `multipart/form-data` with `file` and optional `schoolId`. Files must be `.csv` and no larger than 5 MB.

## Analytics, notifications, and health

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/admin/analytics` | Atlas Admin | Platform analytics |
| `GET` | `/api/analytics/admin` | Atlas Admin | Alias of `/api/admin/analytics` |
| `GET` | `/api/admin/audit-logs?schoolId=&search=` | Atlas Admin | Filterable audit history |
| `GET` | `/api/analytics/school` | Headteacher | Alias of `/api/school/analytics` |
| `GET` | `/api/analytics/school/courses` | Headteacher | Course-level school analytics |
| `GET` | `/api/analytics/school/teachers` | Headteacher | Teacher-level school analytics |
| `GET` | `/api/notifications` | Authenticated | Role-appropriate notifications |
| `GET` | `/api/health` | Public | Application/database health status |

## Environment variables used by the API

```env
DATABASE_URL="postgresql://..."
AUTH_URL="https://atlas.example.com"
AUTH_SECRET="..."
MUX_TOKEN_ID="..."
MUX_TOKEN_SECRET="..."
MUX_SIGNING_KEY_ID="..."
MUX_SIGNING_KEY_PRIVATE_KEY="..."
MUX_WEBHOOK_SECRET="..."
RESEND_API_KEY="..."
EMAIL_FROM="..."
```

Never expose Mux credentials, Auth secrets, database URLs, or email-provider credentials to client-side code.

## Mux integration sequence

1. An owned course editor requests a Direct Upload URL from the lesson upload endpoint.
2. The browser uploads the video directly to Mux using `PUT`.
3. Atlas polls the lesson upload status endpoint while Mux processes the asset.
4. Mux sends signed webhook events to `/api/mux/webhook`.
5. On `video.asset.ready`, Atlas stores the Playback ID and duration on the lesson.
6. Learners request a signed HLS URL through `/api/mux/playback/:playbackId`.
7. Course cards request signed thumbnails through `/api/mux/thumbnail/course/:courseId`.

