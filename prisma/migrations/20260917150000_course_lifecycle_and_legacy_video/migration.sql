-- Add an explicit lifecycle without removing the existing published flag.
-- Keeping published in sync during the transition makes this safe for older
-- application instances during a rolling Vercel deployment.
CREATE TYPE "CourseStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED');

ALTER TABLE "Course"
  ADD COLUMN "status" "CourseStatus" NOT NULL DEFAULT 'DRAFT';

UPDATE "Course"
SET "status" = CASE WHEN "published" THEN 'PUBLISHED'::"CourseStatus" ELSE 'DRAFT'::"CourseStatus" END;

-- Preserve older single-video courses by representing their existing video as
-- a normal lesson. Only courses with no modules are affected; no current
-- structured course content is changed.
INSERT INTO "CourseModule" ("id", "courseId", "title", "description", "sortOrder", "createdAt", "updatedAt")
SELECT 'legacy-module-' || c."id", c."id", 'Course video', NULL, 0, NOW(), NOW()
FROM "Course" c
WHERE c."muxPlaybackId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "CourseModule" m WHERE m."courseId" = c."id")
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Lesson" ("id", "moduleId", "title", "description", "durationSeconds", "muxPlaybackId", "sortOrder", "published", "createdAt", "updatedAt")
SELECT
  'legacy-lesson-' || c."id",
  'legacy-module-' || c."id",
  c."title",
  NULL,
  CASE WHEN c."durationSeconds" > 0 THEN c."durationSeconds" ELSE c."durationMinutes" * 60 END,
  c."muxPlaybackId",
  0,
  c."published",
  NOW(),
  NOW()
FROM "Course" c
WHERE c."muxPlaybackId" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "CourseModule" m WHERE m."id" = 'legacy-module-' || c."id")
ON CONFLICT ("id") DO NOTHING;
