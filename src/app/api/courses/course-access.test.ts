import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), user: vi.fn(), course: vi.fn(), courses: vi.fn(), courseByPlayback: vi.fn(), lesson: vi.fn(), resources: vi.fn(), playback: vi.fn() }))
vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/prisma', () => ({ prisma: {
  user: { findUnique: mocks.user }, course: { findUnique: mocks.course, findMany: mocks.courses, findFirst: mocks.courseByPlayback },
  lesson: { findFirst: mocks.lesson }, courseResource: { findMany: mocks.resources },
} }))
vi.mock('@/lib/mux', () => ({ generatePlaybackUrl: mocks.playback }))
import { GET as getCourse } from '@/app/api/courses/[id]/route'
import { GET as listCourses } from '@/app/api/courses/route'
import { GET as getPlayback } from '@/app/api/mux/playback/[playbackId]/route'

const course = { id: 'course', published: true, status: 'PUBLISHED', audience: 'PARENT', schoolAccess: [], progress: [], modules: [], notes: null, createdById: 'instructor' }
const courseParams = { params: Promise.resolve({ id: 'course' }) }
const playbackParams = { params: Promise.resolve({ playbackId: 'playback' }) }
const request = () => new Request('http://localhost/api/mux/playback/playback?courseId=course')

beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth.mockResolvedValue({ user: { id: 'learner' } })
  mocks.user.mockResolvedValue({ id: 'learner', status: 'ACTIVE', role: 'TEACHER', schoolId: 'school' })
  mocks.course.mockResolvedValue(course)
  mocks.courseByPlayback.mockResolvedValue(course)
  mocks.courses.mockResolvedValue([])
  mocks.lesson.mockResolvedValue(null)
  mocks.resources.mockResolvedValue([])
  mocks.playback.mockResolvedValue('https://stream.example.test/video.m3u8')
})

describe('learner course audience and school restrictions', () => {
  it.each(['TEACHER', 'HEADTEACHER', 'PARENT'])('allows %s to load a parent course without an override', async (role) => {
    mocks.user.mockResolvedValue({ id: 'learner', status: 'ACTIVE', role, schoolId: 'school' })
    const response = await getCourse(request(), courseParams)
    expect(response.status).toBe(200)
    expect((await response.json()).course).toMatchObject({ notes: null, resources: [] })
  })

  it('never allows a parent to access staff-only content, even with an enabled override', async () => {
    mocks.user.mockResolvedValue({ id: 'learner', status: 'ACTIVE', role: 'PARENT', schoolId: 'school' })
    mocks.course.mockResolvedValue({ ...course, audience: 'STAFF', schoolAccess: [{ enabled: true }] })
    expect((await getCourse(request(), courseParams)).status).toBe(403)
    expect(mocks.resources).not.toHaveBeenCalled()
  })

  it.each(['TEACHER', 'HEADTEACHER', 'PARENT'])('honors a disabled school override for %s', async (role) => {
    mocks.user.mockResolvedValue({ id: 'learner', status: 'ACTIVE', role, schoolId: 'school' })
    mocks.course.mockResolvedValue({ ...course, schoolAccess: [{ enabled: false }] })
    expect((await getCourse(request(), courseParams)).status).toBe(403)
  })

  it.each(['DRAFT', 'ARCHIVED'])('denies a published flag paired with %s status', async (status) => {
    mocks.course.mockResolvedValue({ ...course, status })
    expect((await getCourse(request(), courseParams)).status).toBe(403)
  })

  it('queries both audiences for teachers and excludes archived lessons', async () => {
    await listCourses()
    const query = mocks.courses.mock.calls[0][0]
    expect(query.where).not.toHaveProperty('audience')
    expect(query.where).toMatchObject({ published: true, status: 'PUBLISHED' })
    expect(query.include.modules.where.archived).toBe(false)
    expect(query.include.modules.include.lessons.where).toEqual({ published: true, archived: false })
  })

  it('restricts the parent catalog query to the parent audience', async () => {
    mocks.user.mockResolvedValue({ id: 'learner', status: 'ACTIVE', role: 'PARENT', schoolId: 'school' })
    await listCourses()
    expect(mocks.courses.mock.calls[0][0].where).toMatchObject({ published: true, status: 'PUBLISHED', audience: 'PARENT' })
  })
})

describe('signed playback authorization', () => {
  it('allows teachers to play a parent course', async () => {
    expect((await getPlayback(request(), playbackParams)).status).toBe(200)
    expect(mocks.playback).toHaveBeenCalledWith('playback')
  })

  it('does not sign staff-only playback for a parent', async () => {
    mocks.user.mockResolvedValue({ id: 'learner', status: 'ACTIVE', role: 'PARENT', schoolId: 'school' })
    mocks.course.mockResolvedValue({ ...course, audience: 'STAFF' })
    expect((await getPlayback(request(), playbackParams)).status).toBe(403)
    expect(mocks.playback).not.toHaveBeenCalled()
  })

  it('allows the owning instructor to preview a draft', async () => {
    mocks.user.mockResolvedValue({ id: 'instructor', status: 'ACTIVE', role: 'INSTRUCTOR', schoolId: null })
    mocks.course.mockResolvedValue({ ...course, status: 'DRAFT', published: false })
    expect((await getPlayback(request(), playbackParams)).status).toBe(200)
  })

  it('denies an instructor preview of another creator’s video', async () => {
    mocks.user.mockResolvedValue({ id: 'other', status: 'ACTIVE', role: 'INSTRUCTOR', schoolId: null })
    expect((await getPlayback(request(), playbackParams)).status).toBe(403)
    expect(mocks.playback).not.toHaveBeenCalled()
  })

  it('does not sign unpublished or archived lessons for learners', async () => {
    mocks.courseByPlayback.mockResolvedValue(null)
    mocks.lesson.mockResolvedValue({ published: true, archived: true, module: { courseId: 'course', archived: false } })
    expect((await getPlayback(request(), playbackParams)).status).toBe(403)
    expect(mocks.playback).not.toHaveBeenCalled()
  })
})
