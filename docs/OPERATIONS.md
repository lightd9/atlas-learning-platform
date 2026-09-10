# Operations Runbook

## Configuration

Required production settings are `DATABASE_URL`, `AUTH_SECRET`, and `AUTH_URL`. Mux playback/upload requires `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_SIGNING_KEY_ID`, `MUX_SIGNING_KEY_PRIVATE_KEY`, and `MUX_WEBHOOK_SECRET`. Email delivery uses `RESEND_API_KEY` and `EMAIL_FROM`. Never expose these values to browser code or commit them.

## Deployments

Builds run Prisma generation before `next build` (`npm run build`). Apply migrations as a deployment step with `npx prisma migrate deploy`; do not use `migrate dev` against production. After deploy, check `GET /api/health`, sign in as an Atlas Admin, and verify a learner course list.

## Health and diagnosis

`/api/health` is the first check for application/database availability. For “Course not found,” distinguish a real `404` from `403` access denial or `500` database failure in the network response and server logs. A `P6001` error commonly indicates an engine-less or stale Prisma client; stop Next.js and run normal `npx prisma generate`.

For stuck videos, inspect the lesson's `MuxUpload` status, confirm Mux webhook delivery/signature configuration, and check whether the asset reached `READY`. A lesson can retain its Mux asset when the local video association is removed, allowing recovery.

For login failures, check user status, password hash presence, `AUTH_SECRET`, database connectivity, and the login rate-limit bucket. Do not disable rate limiting as a first response; clear only the affected development bucket when appropriate.

## Data safety

Take a database backup before destructive maintenance. Prefer reversible updates and targeted records. Course deletion cascades persisted modules, lessons, resources, school overrides, and progress according to the Prisma schema; treat it as a destructive product operation and rely on backups for recovery.

## Incident notes

Record the UTC timestamp, affected role/school/course, endpoint and status code, deployment version, and relevant audit/Mux IDs. Avoid copying passwords, tokens, signed URLs, or secret configuration into tickets or logs.
