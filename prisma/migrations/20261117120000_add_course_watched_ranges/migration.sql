ALTER TABLE "CourseProgress" ADD COLUMN "watchedRanges" TEXT NOT NULL DEFAULT '[]';

-- Preserve existing credited progress when introducing watched-only seeking.
-- Older course videos recorded a total rather than individual ranges.
UPDATE "CourseProgress"
SET "watchedRanges" = json_build_array(json_build_object(
  'start', 0,
  'end', LEAST("watchedSeconds", CASE WHEN "durationSeconds" > 0 THEN "durationSeconds" ELSE "watchedSeconds" END)
))::text
WHERE "watchedSeconds" > 0;

UPDATE "LessonProgress"
SET "watchedRanges" = json_build_array(json_build_object(
  'start', 0,
  'end', LEAST("watchedSeconds", CASE WHEN "durationSeconds" > 0 THEN "durationSeconds" ELSE "watchedSeconds" END)
))::text
WHERE "watchedRanges" = '[]' AND "watchedSeconds" > 0;

-- Archived courses no longer occupy slots in managed homepage sections.
DELETE FROM "HomePagePlacement"
USING "Course"
WHERE "HomePagePlacement"."courseId" = "Course"."id" AND "Course"."status" = 'ARCHIVED';
