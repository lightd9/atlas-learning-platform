# Atlas UI follow-up — 18 November 2026

The admin overview initially displays two published-course rows on desktop. The number of cards follows the available grid width. View more sits at the bottom right, reveals the loaded cards, and appends the next published-course page without hiding existing cards. View less restores the two-row view. Mobile retains the full loaded list.

Overview requests depend on the signed-in account ID and role. An equivalent session refresh after returning to a tab preserves the course cards and does not repeat the analytics or course requests. Requests are cancelled when leaving the page or changing accounts.

Recommended for you and Discover top courses each use one horizontally scrollable row. Touch swipes, previous/next buttons, and arrow keys reach every configured course. Category changes reset the row; unrelated hero updates preserve its position. Controls respect reduced-motion preferences. Unlock and Explore retain their responsive grids.

Pending invitations have a labeled search field for names, email addresses, schools, roles, inviters, and status. The table groups names and emails, removes the School column, and wraps long text to fit desktop windows. Phone table scrolling stays within the panel. Select all displayed affects the filtered resendable rows and preserves existing selections; Resend all pending keeps its platform-wide scope. Row actions retain their accessible dropdown.

Parent registration uses the supplied photograph of a parent and child learning together, with no graduation mark. The image has responsive cropping and an overlay for readable copy. The shared login image is unchanged.

## Video seeking protection

The existing player tracks the distinct portions of each video a learner has watched. Slider drags, keyboard jumps, forward controls, native seeking, and saved resume positions are restricted to that coverage. Learners can rewind and revisit watched portions. Preview players remain unrestricted.

For example, after watching the first three minutes of a ten-minute video, the learner can return to minute one. Dragging to minute nine returns to the end of the watched portion instead.

The progress API also validates coverage against the stored or Mux video duration. New credit must continue from the beginning or existing watched coverage and cannot exceed elapsed server time, with a maximum of 60 seconds credited per save. A learner/course transaction lock prevents concurrent tabs from multiplying progress. Reporting an end position alone does not grant skipped minutes. Completion requires 95% watched coverage; lesson-based courses derive completion from their lessons. Legacy progress and analytics history were preserved by the existing migration.

These checks measure playback coverage.

## Photograph source

- Current registration image, supplied by the user: `public/photo_2026-11-18_11-23-07.jpg`.
- [Previously used family photograph on Unsplash's image service](https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=max&w=1600&q=85)
- [Unsplash license](https://unsplash.com/license)
- Previous repository asset: `public/parent-registration.webp`.

## Validation

- `npx tsc --noEmit`: passed.
- `npm run test -- --maxWorkers=2`: all 192 tests in 25 suites passed, including player seeking and progress validation.
- `npm run build`: passed with normal Prisma client generation. The selected Neon database has all 29 migrations applied and no pending migrations.
- Desktop overview and invitation layouts passed at widths of 820, 960, 1024, 1280, 1440, and 1920 pixels. Loading additional courses preserved the existing cards. Three tab-refocus cycles refreshed the session six times with no repeat course requests and no empty course frames.
- Invitation search, empty-result recovery, filtered selection, and keyboard dropdown controls passed. Phone scrolling stayed inside the invitation panel.
- The real Neon homepage rendered all five recommended and seven top courses in single rows on desktop, phone, and landscape layouts. The final cards were reachable through controls; native touch events scrolled both rows. Keyboard browsing, category resets, preserved hero-rerender position, and reduced-motion controls passed.
- Parent registration passed at desktop, tablet, and phone sizes with the selected registration photo loaded, readable copy, and no graduation mark.
- The checked pages reported no browser JavaScript errors or page-width overflow.

Browser checks used Edge. Admin and registration API responses were mocked; the public homepage used read-only Neon data. No real invitations were sent or accounts created. The build retained existing CSS alignment and ESLint plugin-configuration notices.
