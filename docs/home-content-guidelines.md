# Home Page Content Guidelines

This is the product and implementation checklist for homepage course management.

## Content model

- A course is independent from where it appears publicly.
- Homepage placement must never duplicate or replace course data.
- A course may appear in multiple sections.
- Removing a placement must not delete the course.

## Managed sections

- Recommended for you
- Discover top courses
- Unlock something new
- Explore catalogue

## Public visibility

- A course is publicly visible only when it is published and actively placed.
- Unpublishing a course removes it from homepage sections, Explore, and navbar search.
- Explore and navbar search must use the same public course dataset.

## Permissions

- Atlas admins have full access.
- Atlas Employees require `HOME_CONTENT_MANAGE` to manage placements.
- Instructors do not manage homepage content through course ownership.
- Permission checks must be enforced by the server and reflected in navigation.

## UX requirements

- Use searchable course selection rather than an unwieldy course checklist.
- Show thumbnails, titles, publication state, and current placement.
- Support add, remove, preview, reorder, and open-editor actions.
- Provide drag-and-drop ordering with accessible move-up and move-down controls.
- Confirm removal from a section, but do not present it as course deletion.
- Preserve the current three planned courses as initial homepage content.

## Delivery checkpoints

1. Data model and migration.
2. Public content/query layer.
3. Homepage and Explore integration.
4. Navbar search integration.
5. Admin Home Page Content interface.
6. Employee permission and server authorization.
7. Ordering, removal, audit records, and tests.
