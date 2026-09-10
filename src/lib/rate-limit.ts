import { prisma } from '@/lib/prisma'

export async function rateLimit(key: string, maxRequests: number = 30, windowMs: number = 60000) {
  const now = Date.now()
  const currentTime = new Date(now)
  const resetAt = new Date(now + windowMs)
  const rows = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimitBucket" (key, count, "resetAt", "updatedAt")
    VALUES (${key}, 1, ${resetAt}, ${currentTime})
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN "RateLimitBucket"."resetAt" <= ${currentTime} THEN 1
        ELSE "RateLimitBucket".count + 1
      END,
      "resetAt" = CASE
        WHEN "RateLimitBucket"."resetAt" <= ${currentTime} THEN ${resetAt}
        ELSE "RateLimitBucket"."resetAt"
      END,
      "updatedAt" = ${currentTime}
    RETURNING count, "resetAt"
  `
  const record = rows[0]
  return {
    allowed: record.count <= maxRequests,
    remaining: Math.max(0, maxRequests - record.count),
    resetAt: record.resetAt.getTime(),
  }
}

export async function resetRateLimit(key: string) {
  await prisma.rateLimitBucket.deleteMany({ where: { key } })
}
