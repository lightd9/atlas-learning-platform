CREATE TABLE "CourseSection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseSection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CourseSection_slug_key" ON "CourseSection"("slug");
CREATE INDEX "CourseSection_active_sortOrder_idx" ON "CourseSection"("active", "sortOrder");

ALTER TABLE "Course" ADD COLUMN "sectionId" TEXT;
CREATE INDEX "Course_sectionId_idx" ON "Course"("sectionId");
ALTER TABLE "Course" ADD CONSTRAINT "Course_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "CourseSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
