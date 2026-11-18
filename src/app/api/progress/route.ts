import { NextResponse } from 'next/server'
import { ProgressStatus, type Prisma } from '@prisma/client'
import { z } from 'zod'
import { requireAvailableCourse, requireSchoolUser } from '@/lib/access'
import { prisma } from '@/lib/prisma'
import { apiErrorResponse } from '@/lib/api-errors'
import {
  calculateCourseProgressFromLessons,
  creditWatchedRanges,
  serializeLessonProgress,
  savedWatchedRanges,
  clampSeekTarget,
} from '@/lib/progress-credit'

const progressSchema = z.object({
  courseId: z.string().min(1),
  lessonId: z.string().min(1).optional(),
  watchedSeconds: z.number().int().nonnegative().optional().default(0),
  durationSeconds: z.number().int().positive().optional(),
  watchedRanges: z.array(z.object({ start: z.number().finite(), end: z.number().finite() })).max(500).optional(),
  lastPositionSeconds: z.number().int().nonnegative().optional(),
})

// A single save may only credit a bounded window of new viewing time. The
// player saves every ~10s, so a generous ceiling still allows genuine playback
// (including brief buffering gaps) while defeating a scrub-to-the-end attempt.
const SESSION_CREDIT_CAP_SECONDS = 60
const SESSION_TOLERANCE_SECONDS = 0

type ProgressRecord = { status: string; completedAt: Date | null } | null | undefined

function sessionElapsedSeconds(lastWatchedAt: Date | null | undefined): number | null {
  if (!lastWatchedAt) return null
  const seconds = (Date.now() - new Date(lastWatchedAt).getTime()) / 1000
  if (!Number.isFinite(seconds)) return null
  return Math.max(0, Math.min(SESSION_CREDIT_CAP_SECONDS, seconds))
}

function progressFields(percent: number, completed: boolean, existing: ProgressRecord) {
  const status: ProgressStatus = completed ? ProgressStatus.COMPLETED : percent > 0 ? ProgressStatus.IN_PROGRESS : ProgressStatus.NOT_STARTED
  const completedAt = completed
    ? existing?.status === 'COMPLETED' && existing.completedAt
      ? existing.completedAt
      : new Date()
    : null
  return { status, completedAt }
}

export async function POST(request: Request) {
  try {
    const user = await requireSchoolUser()
    if (!['TEACHER', 'HEADTEACHER', 'PARENT'].includes(user.role)) throw new Error('FORBIDDEN')
    const parsed = progressSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'Invalid progress payload' }, { status: 400 })

    const { courseId, lessonId, watchedRanges, lastPositionSeconds } = parsed.data
    await requireAvailableCourse(user, courseId)

    return await prisma.$transaction(async (tx) => {
      // Serialize saves for this learner/course, including saves from other
      // tabs, so stale reads cannot overwrite newer watched coverage.
      const lockKey = `progress:${user.id}:${courseId}`
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))::text`
    if (lessonId) {
      // The lesson duration is authoritative; the client-supplied duration is
      // ignored so a forged payload cannot inflate or shrink credit.
      const lesson = await tx.lesson.findFirst({
        where: { id: lessonId, published: true, archived: false, module: { courseId, archived: false } },
        select: { id: true, durationSeconds: true, muxPlaybackId: true },
      })
      if (!lesson) return NextResponse.json({ error: 'Lesson not found for this course' }, { status: 404 })
      const effectiveDuration = await authoritativeDuration(tx, lesson)
      if (!effectiveDuration) return NextResponse.json({ error: 'The video duration is not ready yet. Please try again after the video finishes processing.' }, { status: 503 })

      const existing = await tx.lessonProgress.findUnique({
        where: { userId_lessonId: { userId: user.id, lessonId } },
      })
      const previousRanges = savedWatchedRanges(existing)

      const credit = creditWatchedRanges({
        duration: effectiveDuration,
        previousRanges,
        incomingRanges: watchedRanges ?? [],
        elapsedSeconds: sessionElapsedSeconds(existing?.lastWatchedAt),
        sessionToleranceSeconds: SESSION_TOLERANCE_SECONDS,
      })
      const watchedSeconds = Math.floor(credit.watchedSeconds)
      const percent = Math.min(100, (watchedSeconds / effectiveDuration) * 100)
      const { status, completedAt } = progressFields(percent, credit.completed, existing)
      const lastPosition = Math.floor(clampSeekTarget(lastPositionSeconds ?? 0, credit.ranges, effectiveDuration))

      const lessonProgress = await tx.lessonProgress.upsert({
        where: { userId_lessonId: { userId: user.id, lessonId } },
        create: {
          userId: user.id,
          lessonId,
          watchedSeconds,
          lastPositionSeconds: lastPosition,
          durationSeconds: effectiveDuration,
          watchedRanges: JSON.stringify(credit.ranges),
          percentComplete: percent,
          status,
          completedAt,
          lastWatchedAt: new Date(),
        },
        update: {
          watchedSeconds,
          lastPositionSeconds: lastPosition,
          durationSeconds: effectiveDuration,
          watchedRanges: JSON.stringify(credit.ranges),
          percentComplete: percent,
          status,
          completedAt,
          lastWatchedAt: new Date(),
        },
      })

      const courseCalc = await recomputeCourseProgress(tx, user.id, courseId, lastPosition)
      return NextResponse.json({ progress: serializeLessonProgress(courseCalc), lessonProgress: serializeLessonProgress(lessonProgress) })
    }

    // Course-level posts are never authoritative for lesson-based courses.
    // A client cannot mark such a course complete by posting a full range here.
    const lessonRows = await tx.lesson.findMany({
      where: { module: { courseId, archived: false }, published: true, archived: false },
      select: {
        id: true,
        durationSeconds: true,
        progress: { where: { userId: user.id }, select: { watchedSeconds: true } },
      },
    })
    if (lessonRows.length > 0) {
      const courseCalc = await recomputeCourseProgress(tx, user.id, courseId, 0)
      return NextResponse.json({ progress: serializeLessonProgress(courseCalc) })
    }

    // Genuine course-level video (a course with no lessons). Use the stored
    // course duration and the same bounded range crediting as lessons.
    const course = await tx.course.findUnique({
      where: { id: courseId },
      select: { durationSeconds: true, durationMinutes: true, muxPlaybackId: true },
    })
    if (!course) throw new Error('COURSE_NOT_FOUND')
    const effectiveDuration = await authoritativeDuration(tx, course)
    if (!effectiveDuration) return NextResponse.json({ error: 'The video duration is not ready yet. Please try again after the video finishes processing.' }, { status: 503 })
    const existing = await tx.courseProgress.findUnique({
      where: { userId_courseId: { userId: user.id, courseId } },
    })
    const previousRanges = savedWatchedRanges(existing)
    const credit = creditWatchedRanges({
      duration: effectiveDuration,
      previousRanges,
      incomingRanges: watchedRanges ?? [],
      elapsedSeconds: sessionElapsedSeconds(existing?.lastWatchedAt),
      sessionToleranceSeconds: SESSION_TOLERANCE_SECONDS,
    })
    const watchedSeconds = Math.floor(credit.watchedSeconds)
    const percent = Math.min(100, (watchedSeconds / effectiveDuration) * 100)
    const { status, completedAt } = progressFields(percent, credit.completed, existing)
    const progress = await tx.courseProgress.upsert({
      where: { userId_courseId: { userId: user.id, courseId } },
      create: {
        userId: user.id,
        courseId,
        watchedSeconds,
        watchedRanges: JSON.stringify(credit.ranges),
        durationSeconds: effectiveDuration,
        percentComplete: percent,
        status,
        completedAt,
        lastPositionSeconds: Math.floor(clampSeekTarget(lastPositionSeconds ?? 0, credit.ranges, effectiveDuration)),
        lastWatchedAt: new Date(),
      },
      update: {
        watchedSeconds,
        watchedRanges: JSON.stringify(credit.ranges),
        durationSeconds: effectiveDuration,
        percentComplete: percent,
        status,
        completedAt,
        lastPositionSeconds: Math.floor(clampSeekTarget(lastPositionSeconds ?? 0, credit.ranges, effectiveDuration)),
        lastWatchedAt: new Date(),
      },
    })
    return NextResponse.json({ progress: serializeLessonProgress(progress) })
    }, { timeout: 15000 })
  } catch (error) {
    return apiErrorResponse(error, 'Unable to save progress')
  }
}

async function authoritativeDuration(db: Prisma.TransactionClient, video: { durationSeconds: number; durationMinutes?: number; muxPlaybackId: string | null }) {
  if (video.durationSeconds > 0) return video.durationSeconds
  if (video.durationMinutes && video.durationMinutes > 0) return video.durationMinutes * 60
  if (!video.muxPlaybackId) return 0
  const asset = await db.muxAsset.findFirst({ where: { playbackId: video.muxPlaybackId, status: 'ready' }, select: { duration: true } })
  return asset?.duration && asset.duration > 0 ? Math.ceil(asset.duration) : 0
}

async function recomputeCourseProgress(db: Prisma.TransactionClient, userId: string, courseId: string, lastPosition: number) {
  const lessons = await db.lesson.findMany({
    where: { module: { courseId, archived: false }, published: true, archived: false },
    select: {
      id: true,
      durationSeconds: true,
      progress: { where: { userId }, select: { watchedSeconds: true, durationSeconds: true } },
    },
  })
  const calc = calculateCourseProgressFromLessons(
    lessons.map((lesson) => ({
      durationSeconds: lesson.durationSeconds || lesson.progress[0]?.durationSeconds || 0,
      watchedSeconds: lesson.progress[0]?.watchedSeconds ?? 0,
    })),
  )
  const existing = await db.courseProgress.findUnique({
    where: { userId_courseId: { userId, courseId } },
  })
  const { status, completedAt } = progressFields(calc.percentComplete, calc.completed, existing)
  return db.courseProgress.upsert({
    where: { userId_courseId: { userId, courseId } },
    create: {
      userId,
      courseId,
      watchedSeconds: calc.watchedSeconds,
      durationSeconds: calc.durationSeconds,
      percentComplete: calc.percentComplete,
      status,
      completedAt,
      lastPositionSeconds: lastPosition,
      lastWatchedAt: new Date(),
    },
    update: {
      watchedSeconds: calc.watchedSeconds,
      durationSeconds: calc.durationSeconds,
      percentComplete: calc.percentComplete,
      status,
      completedAt,
      lastWatchedAt: new Date(),
    },
  })
}
