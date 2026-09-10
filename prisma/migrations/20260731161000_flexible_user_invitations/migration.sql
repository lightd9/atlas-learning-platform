-- Atlas Admin and Instructor invitations do not belong to a school.
ALTER TABLE "Invitation" ALTER COLUMN "schoolId" DROP NOT NULL;
ALTER TABLE "Invitation" ADD COLUMN IF NOT EXISTS "role" "UserRole" NOT NULL DEFAULT 'TEACHER';
