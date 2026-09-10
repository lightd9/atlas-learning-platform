CREATE TABLE IF NOT EXISTS "EmailDelivery" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "providerId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EmailDelivery_to_createdAt_idx" ON "EmailDelivery"("to", "createdAt");
CREATE INDEX IF NOT EXISTS "EmailDelivery_status_createdAt_idx" ON "EmailDelivery"("status", "createdAt");
