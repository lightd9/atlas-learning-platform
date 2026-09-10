import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAvailableCourse, requireSchoolUser } from '@/lib/access'
import { prisma } from '@/lib/prisma'
import { apiErrorResponse } from '@/lib/api-errors'

const progressSchema = z.object({
  courseId: z.string().min(1),
  lessonId: z.string().min(1).optional(),
  watchedSeconds: z.number().int().nonnegative(),
  durationSeconds: z.number().int().positive(),
  watchedRanges: z.array(z.object({ start: z.number().finite(), end: z.number().finite() })).max(500).optional(),
})

type WatchedRange = { start: number; end: number }

function mergeRanges(ranges: WatchedRange[], duration: number) {
  const normalized = ranges
    .map((range) => ({ start: Math.max(0, Math.min(duration, range.start)), end: Math.max(0, Math.min(duration, range.end)) }))
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start)
  const merged: WatchedRange[] = []
  for (const range of normalized) {
    const previous = merged[merged.length - 1]
    if (previous && range.start <= previous.end + 0.5) previous.end = Math.max(previous.end, range.end)
    else merged.push({ ...range })
  }
  return merged
}

function rangeCoverage(ranges: WatchedRange[]) {
  return Math.floor(ranges.reduce((total, range) => total + (range.end - range.start), 0))
}

export async function POST(request: Request) {
  try {
    const user = await requireSchoolUser()
    const parsed = progressSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'Invalid progress payload' }, { status: 400 })

    const { courseId, lessonId, watchedSeconds, durationSeconds, watchedRanges } = parsed.data
    await requireAvailableCourse(user, courseId)
    const percent = Math.min(100, (watchedSeconds / durationSeconds) * 100)
    const completed = percent >= 95
    if (lessonId) {
      const lesson = await prisma.lesson.findFirst({ where: { id: lessonId, published: true, module: { courseId } } })
      if (!lesson) return NextResponse.json({ error: 'Lesson not found for this course' }, { status: 404 })
      const effectiveDuration = Math.max(1, lesson.durationSeconds || durationSeconds)
      const existing = await prisma.lessonProgress.findUnique({ where: { userId_lessonId: { userId: user.id, lessonId } } })
      let previousRanges: WatchedRange[] = []
      if (existing?.watchedRanges) {
        try { previousRanges = JSON.parse(existing.watchedRanges) as WatchedRange[] } catch { previousRanges = [] }
      }
      // Legacy records had only a single watched position. Preserve their history as a
      // conservative range, while all new completion decisions use actual ranges.
      if (previousRanges.length === 0 && existing?.watchedSeconds) previousRanges = [{ start: 0, end: Math.min(existing.watchedSeconds, effectiveDuration) }]
      const ranges = mergeRanges([...previousRanges, ...(watchedRanges ?? [])], effectiveDuration)
      const coveredSeconds = Math.min(effectiveDuration, rangeCoverage(ranges))
      const percent = Math.min(100, (coveredSeconds / effectiveDuration) * 100)
      const completed = percent >= 95
      await prisma.lessonProgress.upsert({
        where: { userId_lessonId: { userId: user.id, lessonId } },
        create: { userId: user.id, lessonId, watchedSeconds: coveredSeconds, durationSeconds: effectiveDuration, watchedRanges: JSON.stringify(ranges), percentComplete: percent, status: completed ? 'COMPLETED' : percent > 0 ? 'IN_PROGRESS' : 'NOT_STARTED', completedAt: completed ? new Date() : null, lastWatchedAt: new Date() },
        update: { watchedSeconds: coveredSeconds, durationSeconds: effectiveDuration, watchedRanges: JSON.stringify(ranges), percentComplete: percent, status: completed ? 'COMPLETED' : percent > 0 ? 'IN_PROGRESS' : 'NOT_STARTED', completedAt: completed ? new Date() : null, lastWatchedAt: new Date() },
      })
      const lessons = await prisma.lesson.findMany({ where: { module: { courseId }, published: true }, include: { progress: { where: { userId: user.id } } } })
      const totalDuration = lessons.reduce((sum, item) => sum + (item.durationSeconds || 0), 0)
      const watchedTotal = lessons.reduce((sum, item) => sum + Math.min(item.durationSeconds || 0, item.progress[0]?.watchedSeconds || 0), 0)
      const coursePercent = totalDuration > 0 ? Math.min(100, (watchedTotal / totalDuration) * 100) : 0
      const courseCompleted = coursePercent >= 95
      const courseProgress = await prisma.courseProgress.upsert({
        where: { userId_courseId: { userId: user.id, courseId } },
        create: { userId: user.id, courseId, watchedSeconds: watchedTotal, durationSeconds: totalDuration, percentComplete: coursePercent, status: courseCompleted ? 'COMPLETED' : coursePercent > 0 ? 'IN_PROGRESS' : 'NOT_STARTED', completedAt: courseCompleted ? new Date() : null, lastWatchedAt: new Date() },
        update: { watchedSeconds: watchedTotal, durationSeconds: totalDuration, percentComplete: coursePercent, status: courseCompleted ? 'COMPLETED' : coursePercent > 0 ? 'IN_PROGRESS' : 'NOT_STARTED', completedAt: courseCompleted ? new Date() : null, lastWatchedAt: new Date() },
      })
      return NextResponse.json({ progress: courseProgress })
    }
    const progress = await prisma.courseProgress.upsert({
      where: { userId_courseId: { userId: user.id, courseId } },
      create: {
        userId: user.id,
        courseId,
        watchedSeconds,
        durationSeconds,
        percentComplete: percent,
        status: completed ? 'COMPLETED' : percent > 0 ? 'IN_PROGRESS' : 'NOT_STARTED',
        completedAt: completed ? new Date() : null,
        lastWatchedAt: new Date(),
      },
      update: {
        watchedSeconds: { set: watchedSeconds },
        durationSeconds: { set: durationSeconds },
        percentComplete: { set: percent },
        status: { set: completed ? 'COMPLETED' : percent > 0 ? 'IN_PROGRESS' : 'NOT_STARTED' },
        completedAt: completed ? new Date() : undefined,
        lastWatchedAt: { set: new Date() },
      },
    })
    return NextResponse.json({ progress })
  } catch (error) {
    return apiErrorResponse(error, 'Unable to save progress')
  }
}
