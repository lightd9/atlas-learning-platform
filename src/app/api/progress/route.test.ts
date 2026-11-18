import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  user: vi.fn(), available: vi.fn(), transaction: vi.fn(), lock: vi.fn(),
  lesson: vi.fn(), lessons: vi.fn(), course: vi.fn(), asset: vi.fn(),
  courseProgress: vi.fn(), saveCourse: vi.fn(), lessonProgress: vi.fn(), saveLesson: vi.fn(),
}))
vi.mock('@/lib/access', () => ({ requireSchoolUser: mocks.user, requireAvailableCourse: mocks.available }))
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: mocks.transaction } }))
import { POST } from '@/app/api/progress/route'

const now = new Date('2026-11-18T10:00:00Z')
let savedCourse: Record<string, unknown> | null
let savedLesson: Record<string, unknown> | null
const request = (overrides = {}) => new Request('http://localhost/api/progress', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ courseId: 'course', watchedRanges: [{ start: 0, end: 600 }], lastPositionSeconds: 600, ...overrides }),
})

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(now)
  savedCourse = null
  savedLesson = null
  mocks.user.mockResolvedValue({ id: 'learner', schoolId: 'school', role: 'TEACHER' })
  mocks.available.mockResolvedValue({ id: 'course' })
  mocks.course.mockResolvedValue({ durationSeconds: 600, durationMinutes: 10, muxPlaybackId: null })
  mocks.lesson.mockResolvedValue({ id: 'lesson', durationSeconds: 600, muxPlaybackId: null })
  mocks.lessons.mockResolvedValue([])
  mocks.asset.mockResolvedValue(null)
  mocks.courseProgress.mockImplementation(async () => savedCourse)
  mocks.lessonProgress.mockImplementation(async () => savedLesson)
  mocks.saveCourse.mockImplementation(async ({ create, update }) => {
    savedCourse = { ...(savedCourse ?? {}), ...(savedCourse ? update : create) }
    return savedCourse
  })
  mocks.saveLesson.mockImplementation(async ({ create, update }) => {
    savedLesson = { ...(savedLesson ?? {}), ...(savedLesson ? update : create) }
    return savedLesson
  })
  mocks.transaction.mockImplementation(async (run) => run({
    $queryRaw: mocks.lock, course: { findUnique: mocks.course }, muxAsset: { findFirst: mocks.asset },
    lesson: { findFirst: mocks.lesson, findMany: mocks.lessons },
    courseProgress: { findUnique: mocks.courseProgress, upsert: mocks.saveCourse },
    lessonProgress: { findUnique: mocks.lessonProgress, upsert: mocks.saveLesson },
  }))
})
afterEach(() => vi.useRealTimers())

describe('authoritative progress credit', () => {
  it('starts a session without granting unobserved viewing time', async () => {
    const response = await POST(request({ watchedSeconds: 600, durationSeconds: 1 }))
    expect(response.status).toBe(200)
    expect((await response.json()).progress).toMatchObject({ watchedSeconds: 0, lastPositionSeconds: 0, durationSeconds: 600, status: 'NOT_STARTED', watchedRanges: [] })
    expect(mocks.lock).toHaveBeenCalledBefore(mocks.courseProgress)
  })

  it('ignores forged totals/durations and caps new credit at elapsed time', async () => {
    await POST(request({ watchedRanges: [] }))
    vi.setSystemTime(now.getTime() + 10_000)
    const response = await POST(request({ durationSeconds: 1, watchedSeconds: 999999 }))
    expect((await response.json()).progress).toMatchObject({ watchedSeconds: 10, durationSeconds: 600, lastPositionSeconds: 10, status: 'IN_PROGRESS' })
  })

  it('cannot gain repeated allowances from immediate requests', async () => {
    await POST(request({ watchedRanges: [] }))
    vi.setSystemTime(now.getTime() + 10_000)
    await POST(request())
    for (let index = 0; index < 5; index++) await POST(request())
    expect(savedCourse?.watchedSeconds).toBe(10)
  })

  it('rejects disjoint new ranges after a forward seek', async () => {
    await POST(request({ watchedRanges: [] }))
    vi.setSystemTime(now.getTime() + 10_000)
    const response = await POST(request({ watchedRanges: [{ start: 590, end: 600 }] }))
    expect((await response.json()).progress.watchedSeconds).toBe(0)
  })

  it('keeps earlier watched coverage when no ranges are supplied', async () => {
    savedCourse = { watchedRanges: '[{"start":0,"end":20}]', watchedSeconds: 20, durationSeconds: 600, lastWatchedAt: now, status: 'IN_PROGRESS', completedAt: null }
    const response = await POST(request({ watchedRanges: undefined, lastPositionSeconds: 10 }))
    expect((await response.json()).progress).toMatchObject({ watchedSeconds: 20, lastPositionSeconds: 10, watchedRanges: [{ start: 0, end: 20 }] })
  })

  it('caps a long idle interval to 60 seconds', async () => {
    await POST(request({ watchedRanges: [] }))
    vi.setSystemTime(now.getTime() + 3_600_000)
    await POST(request())
    expect(savedCourse?.watchedSeconds).toBe(60)
  })

  it('does not trust a client duration when no server duration is known', async () => {
    mocks.course.mockResolvedValue({ durationSeconds: 0, durationMinutes: 0, muxPlaybackId: null })
    expect((await POST(request({ durationSeconds: 600 }))).status).toBe(503)
    expect(mocks.saveCourse).not.toHaveBeenCalled()
  })

  it('uses a stored Mux asset duration when course metadata is not ready', async () => {
    mocks.course.mockResolvedValue({ durationSeconds: 0, durationMinutes: 0, muxPlaybackId: 'playback' })
    mocks.asset.mockResolvedValue({ duration: 99.2 })
    const response = await POST(request())
    expect((await response.json()).progress.durationSeconds).toBe(100)
  })
})

describe('lesson completion and permissions', () => {
  it('cannot complete a lesson-based course with a course-level payload', async () => {
    mocks.lessons.mockResolvedValue([
      { id: 'one', durationSeconds: 100, progress: [{ watchedSeconds: 100, durationSeconds: 100 }] },
      { id: 'two', durationSeconds: 100, progress: [] },
    ])
    const response = await POST(request({ watchedSeconds: 200, durationSeconds: 200, watchedRanges: [{ start: 0, end: 200 }] }))
    expect((await response.json()).progress).toMatchObject({ watchedSeconds: 100, durationSeconds: 200, percentComplete: 50, status: 'IN_PROGRESS', completedAt: null })
  })

  it('keeps a course incomplete when a lesson duration is unknown', async () => {
    mocks.lessons.mockResolvedValue([{ id: 'one', durationSeconds: 0, progress: [] }])
    const response = await POST(request())
    expect((await response.json()).progress.status).toBe('NOT_STARTED')
  })

  it('only accepts published, active lessons belonging to the requested course', async () => {
    mocks.lesson.mockResolvedValue(null)
    expect((await POST(request({ lessonId: 'foreign-lesson' }))).status).toBe(404)
    expect(mocks.lesson).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'foreign-lesson', published: true, archived: false, module: { courseId: 'course', archived: false } } }))
    expect(mocks.saveLesson).not.toHaveBeenCalled()
  })

  it.each(['ATLAS_ADMIN', 'INSTRUCTOR'])('does not record progress for %s previews', async (role) => {
    mocks.user.mockResolvedValue({ id: 'preview', role, schoolId: null })
    expect((await POST(request())).status).toBe(403)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('keeps school and audience access checks ahead of progress writes', async () => {
    mocks.available.mockRejectedValue(new Error('FORBIDDEN'))
    expect((await POST(request())).status).toBe(403)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})
