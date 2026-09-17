-- Retire course content without deleting learner progress or analytics history.
ALTER TABLE "CourseModule" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Lesson" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "CourseModule_courseId_archived_sortOrder_idx" ON "CourseModule"("courseId", "archived", "sortOrder");
CREATE INDEX "Lesson_moduleId_archived_sortOrder_idx" ON "Lesson"("moduleId", "archived", "sortOrder");
