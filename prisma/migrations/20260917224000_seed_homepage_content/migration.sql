UPDATE "Course"
SET "published" = true, "status" = 'PUBLISHED'
WHERE "slug" IN ('introduction-to-ai', 'ai-safety', 'practical-ai');

INSERT INTO "HomePagePlacement" ("id", "courseId", "section", "sortOrder", "active", "createdAt", "updatedAt")
SELECT
  'homepage_' || c."slug" || '_' || s."section",
  c."id",
  s."section"::"HomePageSection",
  CASE c."slug"
    WHEN 'introduction-to-ai' THEN 0
    WHEN 'ai-safety' THEN 1
    ELSE 2
  END,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Course" c
CROSS JOIN (VALUES
  ('RECOMMENDED'),
  ('TOP_COURSES'),
  ('UNLOCK_SOMETHING_NEW'),
  ('EXPLORE')
) AS s("section")
WHERE c."slug" IN ('introduction-to-ai', 'ai-safety', 'practical-ai')
ON CONFLICT ("courseId", "section") DO NOTHING;
