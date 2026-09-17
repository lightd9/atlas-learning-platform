-- Add second-level duration tracking to courses. Existing courses use the
-- durationMinutes fallback until an editor saves an exact mm:ss duration.
ALTER TABLE "Course" ADD COLUMN "durationSeconds" INTEGER NOT NULL DEFAULT 0;