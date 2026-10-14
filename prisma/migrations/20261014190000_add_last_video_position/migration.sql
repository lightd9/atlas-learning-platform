ALTER TABLE "LessonProgress" ADD COLUMN "lastPositionSeconds" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CourseProgress" ADD COLUMN "lastPositionSeconds" INTEGER NOT NULL DEFAULT 0;
