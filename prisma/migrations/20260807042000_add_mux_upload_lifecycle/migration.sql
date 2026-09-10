CREATE TYPE "MuxUploadStatus" AS ENUM ('CREATING', 'WAITING', 'PROCESSING', 'READY', 'FAILED', 'CANCELLED');

CREATE TABLE "MuxUpload" (
    "id" TEXT NOT NULL,
    "muxUploadId" TEXT,
    "muxAssetId" TEXT,
    "playbackId" TEXT,
    "courseId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "filename" TEXT,
    "sizeBytes" BIGINT,
    "duration" DOUBLE PRECISION,
    "status" "MuxUploadStatus" NOT NULL DEFAULT 'CREATING',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "rawData" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MuxUpload_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MuxUpload_muxUploadId_key" ON "MuxUpload"("muxUploadId");
CREATE UNIQUE INDEX "MuxUpload_muxAssetId_key" ON "MuxUpload"("muxAssetId");
CREATE INDEX "MuxUpload_courseId_lessonId_createdAt_idx" ON "MuxUpload"("courseId", "lessonId", "createdAt");
CREATE INDEX "MuxUpload_status_updatedAt_idx" ON "MuxUpload"("status", "updatedAt");
