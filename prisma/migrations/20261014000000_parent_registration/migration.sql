-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'PARENT';

-- CreateEnum
CREATE TYPE "CourseAudience" AS ENUM ('STAFF', 'PARENT');

-- AlterTable
ALTER TABLE "School"
ADD COLUMN "parentRegistrationToken" TEXT,
ADD COLUMN "parentRegistrationEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "parentRegistrationTokenCreatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "School_parentRegistrationToken_key" ON "School"("parentRegistrationToken");

-- AlterTable
ALTER TABLE "Course" ADD COLUMN "audience" "CourseAudience" NOT NULL DEFAULT 'STAFF';
