# Development Guide

## Daily workflow

1. Pull the branch and inspect `git status`; preserve unrelated worktree changes.
2. Start PostgreSQL with `npm run db:up` or point `DATABASE_URL` at a development database.
3. Apply committed migrations with `npx prisma migrate deploy`, then run normal `npx prisma generate`.
4. Run `npm run dev` and exercise the relevant role workflow.
5. Before handoff, run `npx tsc --noEmit` and `npm run test`.

Use the repository alias `@/*` for imports from `src`. Keep server-only secrets and Prisma imports out of client components. Follow existing shell components (`AdminShell`, `AuthShell`, `AccountShell`) and prototype styles before introducing new layout primitives.

## Adding an API route

Start by choosing the narrowest access helper. Parse and validate body/query input, verify resource ownership for nested IDs, then execute Prisma work. Return explicit status codes and a stable `{ error: string }` shape for failures. Add audit logging for administrative mutations and rate limiting for public token/password flows. Update `API.md` when the public contract changes.

## Database changes

Edit `prisma/schema.prisma`, create a timestamped migration, apply it locally, and regenerate the client:

```powershell
npx prisma migrate dev --name describe_change
npx prisma generate
```

Never reset the database to solve application problems. Preserve existing progress, analytics, disabled users, schools, and legacy courses with null owners. If Prisma files are locked, stop the local Next.js process, run the normal generate command, and restart it.

Next.js loads `.env.development.local` or `.env.production.local` ahead of `.env.local`, while Prisma CLI loads `.env`. Keep database settings aligned with the intended environment. Set both `DATABASE_URL` and `DATABASE_URL_UNPOOLED`: for Neon, use its pooled URL at runtime and its direct URL for migrations; for local PostgreSQL, both variables can use the same connection string. Prisma's datasource `directUrl` ensures normal CLI migration commands use `DATABASE_URL_UNPOOLED`. The build migration helper loads Next.js production env files and launches the Prisma CLI with Node so it also works on Windows.

The watched-range migration adds course-level coverage, backfills legacy course/lesson totals without resetting progress or completion history, and removes archived courses' homepage placements. Deploy it before using the updated progress API. Existing invitation expiries are preserved; new and resent links use the configured 30-day default.

## Testing expectations

Vitest tests live beside libraries, routes and components under `src/**/*.test.{ts,tsx}`. Library and route tests use Node; component interaction tests explicitly select jsdom. Keep pure validation/formatting logic unit-tested. For authorization or course work, test at least: Atlas Admin access, instructor access to an owned course, instructor denial for another owner, and empty optional notes/resources. For migrations or authentication, verify a real configured database and one relevant role. Exercise partial resend failure, parent/staff access restrictions, forged progress payloads, and slider/keyboard/native seeking when changing those workflows.

## Review checklist

- Server-side authorization is present on every relevant route.
- `401`, `403`, `404`, and `500` behavior remains distinguishable.
- Input is bounded and validated; public token/password endpoints are rate-limited.
- Transactions and cascade behavior cannot orphan course content or progress.
- Loading, empty, error, and success UI states are explicit and keyboard accessible.
- Documentation and `API.md` match the implementation.
