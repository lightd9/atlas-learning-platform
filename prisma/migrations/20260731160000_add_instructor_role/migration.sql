-- Add the course-authoring role used by Atlas instructors.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'INSTRUCTOR';
