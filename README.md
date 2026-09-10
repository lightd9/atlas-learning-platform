# Atlas Learning Platform

Atlas is a multi-school learning platform for professional development. Atlas administrators manage schools, users, course publication, school access, and platform analytics. Instructors own and maintain their courses. Headteachers manage teachers and school analytics. Teachers and headteachers consume assigned courses and record progress.

## Stack

- Next.js 15 App Router, React 19, and TypeScript (strict mode)
- Auth.js credentials authentication with bcrypt password hashes and JWT sessions
- Prisma 6 with PostgreSQL
- Mux Direct Uploads and signed HLS playback
- Resend for invitation and password-reset email
- Vitest for unit tests

## Quick start

Prerequisites: Node.js 20+, Docker Desktop, and a PostgreSQL connection.

```powershell
Copy-Item .env.example .env.local
npm install
npm run db:up
npx prisma migrate deploy
npx prisma generate
npm run dev
```

Open `http://localhost:3000`. Set a real `AUTH_SECRET` before using a shared environment. `RESEND_API_KEY` and Mux variables are optional for local UI work; email falls back to development logging and video features remain unavailable until Mux is configured.

Useful commands:

```powershell
npm run test
npx tsc --noEmit
npm run build
npm run db:seed
npm run db:down
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md): boundaries, request flows, authorization, and persistence model.
- [Development guide](docs/DEVELOPMENT.md): local workflow, conventions, testing, and change checklist.
- [Operations runbook](docs/OPERATIONS.md): deployment, migrations, Mux/email configuration, and diagnosis.
- [API reference](API.md): endpoint-level request and response contracts.
- [Agent guide](AGENTS.md): non-negotiable product and implementation rules for contributors.

## Repository map

`src/app` contains pages and API route handlers. `src/components` contains shared UI. `src/lib` contains access control, Prisma, Mux, email, audit, rate limiting, and serialization helpers. `prisma/schema.prisma` is the source of truth for the data model; SQL migrations live under `prisma/migrations`.

## Security model

Middleware protects browser pages from unauthenticated access, but it is not authorization. Every API route must call the appropriate helper from `src/lib/access.ts`. Instructors can only mutate courses where `Course.createdById` equals their user ID. School-course overrides are evaluated in addition to publication status. Secrets must remain server-side.

## Contribution standard

Keep changes scoped, preserve existing school and progress data, add migrations for schema changes, and update the relevant documentation when a contract changes. Before handoff, run `npx tsc --noEmit` and `npm run test`; for Prisma changes also run normal `npx prisma generate` and verify a relevant role workflow.
