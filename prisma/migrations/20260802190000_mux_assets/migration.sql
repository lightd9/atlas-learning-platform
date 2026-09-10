CREATE TABLE IF NOT EXISTS "MuxAsset" (
    "id" TEXT NOT NULL,
    "playbackId" TEXT,
    "status" TEXT NOT NULL,
    "passthrough" TEXT,
    "duration" DOUBLE PRECISION,
    "rawData" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MuxAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MuxAsset_playbackId_idx" ON "MuxAsset"("playbackId");
CREATE INDEX IF NOT EXISTS "MuxAsset_status_updatedAt_idx" ON "MuxAsset"("status", "updatedAt");
