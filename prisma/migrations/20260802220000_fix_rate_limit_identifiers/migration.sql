ALTER TABLE ratelimitbucket RENAME TO "RateLimitBucket";
ALTER TABLE "RateLimitBucket" RENAME COLUMN resetat TO "resetAt";
ALTER TABLE "RateLimitBucket" RENAME COLUMN updatedat TO "updatedAt";
