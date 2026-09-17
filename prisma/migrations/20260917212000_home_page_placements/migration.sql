CREATE TYPE "HomePageSection" AS ENUM ('RECOMMENDED', 'TOP_COURSES', 'UNLOCK_SOMETHING_NEW', 'EXPLORE');

CREATE TABLE "HomePagePlacement" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "section" "HomePageSection" NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HomePagePlacement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HomePagePlacement_courseId_section_key" ON "HomePagePlacement"("courseId", "section");
CREATE INDEX "HomePagePlacement_section_active_sortOrder_idx" ON "HomePagePlacement"("section", "active", "sortOrder");
ALTER TABLE "HomePagePlacement" ADD CONSTRAINT "HomePagePlacement_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
