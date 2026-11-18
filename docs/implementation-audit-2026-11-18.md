# Atlas implementation audit — 18 November 2026

The seven requested areas were reviewed against the current implementation. Existing worktree changes were preserved, and remaining access, invitation, homepage, and progress gaps were corrected.

The subsequent layout changes and video-seeking explanation are recorded in the [UI follow-up](ui-follow-up-2026-11-18.md).

| Request | Result |
| --- | --- |
| Invitation expiry | New and resent invitations default to 30 days, configurable through `INVITATION_TTL_DAYS`. Email wording follows the configuration. Existing links retain their stored expiry dates. |
| Bulk resend and row actions | Resend all and Resend selected are available above the invitation tables. Row actions use an accessible dropdown. Server permissions, school boundaries, cooldowns, token rotation, audit logs, and partial delivery summaries were verified. |
| Admin course layout | The admin overview uses a responsive grid with pagination. All 18 published courses in the verification dataset were accessible. Instructor ownership and workspace navigation remain enforced. |
| Parent courses for staff | Teachers and headteachers can access published staff and parent courses. Parents can access only parent courses. School restrictions apply to both audiences. |
| Parent registration image | Registration now uses a dedicated optimized family photograph, added in the UI follow-up. The shared login image is preserved. |
| Watched-only seeking | Learners can revisit watched portions; forward jumps into unwatched portions are blocked. Editor and school preview players retain unrestricted seeking. The server validates duration, credit growth, ranges, and resume position. |
| Homepage content | Published courses from both audiences can be placed on the public homepage. Configured cards render responsively, and archived/deleted courses are removed from content management as well as the public homepage. |

## Homepage count correction

The real Neon data reproduced the reported issue exactly: Recommended contained five active placements, including one parent course; Discover top courses contained seven, including three parent courses. A staff-only filter reduced both sections to four cards.

The shared eligibility rules, public API, admin placement selector, and Explore page now allow both published audiences. Explore also had a separate staff-only query that hid one of its five placements and excluded that parent course from search. Video access still requires the relevant role and school permissions, and the public response excludes Mux playback IDs. Regression tests reproduce the five/seven homepage counts and Explore's five/four count and search failures.

| Section | Current Neon placements | Configured limit |
| --- | ---: | --- |
| Recommended for you | 5 | 8 |
| Discover top courses | 7 | Unlimited |
| Unlock something new | 2 | 12 |
| Explore | 5 | Unlimited |

Larger layouts were also checked with eight recommended, sixteen top, and twelve unlock cards in the isolated verification database.

## Additional corrections

- Failed invitation delivery restores the previous token, expiry, and update time. Self-service resend uses the same reservation and restoration rules. Concurrent resends and revocations are detected.
- Invitation reloads preserve unsaved school course selections. Discard restores the saved selection; selecting every available course removes redundant school overrides.
- Invitation network failures release the busy state. Action menus support keyboard navigation, portal positioning, and empty menus.
- Instructor actions match server permissions, including ownership denial for foreign and legacy unowned courses. Empty optional notes and resources do not prevent loading.
- Relevant APIs distinguish database failures from authorization and missing-course errors.
- Switching lessons preserves the final watched seconds even after React clears the video element reference.
- Development, production, and Prisma CLI database URLs now agree with the selected Neon database. Prisma uses the pooled runtime URL and direct migration URL. The build migration helper uses Next.js production environment precedence and works on Windows.

## Database verification

Migration `20261117120000_add_course_watched_ranges` was deployed to Neon with normal Prisma client generation. All 29 committed migrations are applied.

The checks preserved 74 users, 14 schools, 12 courses, 53 course-progress records, and 102 lesson-progress records. Checksums exclude only the watched-range and resume-position fields intentionally handled by migration. Credited legacy progress has watched ranges, archived homepage placements are absent, and the course-placement foreign key cascades on permanent deletion.

Temporary browser fixtures were removed from the local Docker database. Original record checksums were verified; one unrelated mock delivery log was retained.

## Validation

- `npx tsc --noEmit`: passed.
- `npm run test`: 184 tests in 22 suites passed.
- Normal `npx prisma generate`: passed.
- `npx prisma migrate deploy`: passed against Neon; no pending migrations.
- Atlas Admin, instructor, headteacher, teacher, and parent authentication/access were checked using isolated fixtures.
- Browser/API checks covered responsive layouts, invitation actions, partial delivery summaries, school selections, ownership, role boundaries, progress locking, and homepage cleanup.
- `npm run build`: passed. The existing ESLint configuration reports that the Next.js plugin is not configured; the first build also reported existing CSS alignment compatibility warnings.
- Final production checks against Neon: all eight checks passed with no browser JavaScript errors. Desktop and mobile pages render all configured courses (5 recommended, 7 top, 2 unlock, and 5 Explore), covers load, layouts have no horizontal overflow, public search finds the parent course, and course APIs still require authentication.

Email delivery and failures were simulated; no real invitations were dispatched. Responsive browser checks used Chromium/Edge at desktop and mobile viewport sizes. Seeking checks exercised player interactions and the real progress API with fixtures; physical-device playback was not tested.
