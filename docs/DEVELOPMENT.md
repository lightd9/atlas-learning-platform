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

## Testing expectations

Vitest tests live beside library code under `src/lib/*.test.ts`. Keep pure validation/formatting logic unit-tested. For authorization or course work, test at least: Atlas Admin access, instructor access to an owned course, instructor denial for another owner, and empty optional notes/resources. For migrations or authentication, verify a real configured database and one relevant role.

## Review checklist

- Server-side authorization is present on every relevant route.
- `401`, `403`, `404`, and `500` behavior remains distinguishable.
- Input is bounded and validated; public token/password endpoints are rate-limited.
- Transactions and cascade behavior cannot orphan course content or progress.
- Loading, empty, error, and success UI states are explicit and keyboard accessible.
- Documentation and `API.md` match the implementation.
