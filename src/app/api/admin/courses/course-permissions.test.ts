import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), user: vi.fn(), course: vi.fn(), resources: vi.fn(),
  schoolCount: vi.fn(), update: vi.fn(), delete: vi.fn(), placements: vi.fn(), transaction: vi.fn(),
}))
vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/prisma', () => ({ prisma: {
  user: { findUnique: mocks.user },
  course: { findUnique: mocks.course, delete: mocks.delete },
  courseResource: { findMany: mocks.resources }, school: { count: mocks.schoolCount },
  $transaction: mocks.transaction,
} }))

import { GET, PATCH, DELETE } from '@/app/api/admin/courses/[id]/route'

const course = {
  id: 'course', createdById: 'instructor', title: 'Course', notes: null,
  status: 'PUBLISHED', published: true, audience: 'STAFF',
  _count: { progress: 0 }, schoolAccess: [], section: null,
}
const params = { params: Promise.resolve({ id: 'course' }) }
const request = (data?: unknown) => new Request('http://localhost/api/admin/courses/course', {
  method: data === undefined ? 'GET' : 'PATCH',
  ...(data === undefined ? {} : { body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } }),
})

beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth.mockResolvedValue({ user: { id: 'instructor' } })
  mocks.user.mockResolvedValue({ id: 'instructor', role: 'INSTRUCTOR', status: 'ACTIVE', permissions: [] })
  mocks.course.mockResolvedValue(course)
  mocks.resources.mockResolvedValue([])
  mocks.schoolCount.mockResolvedValue(2)
  mocks.delete.mockResolvedValue(course)
  mocks.update.mockImplementation(async ({ data }) => ({ ...course, ...data }))
  mocks.transaction.mockImplementation(async (run) => run({
    course: { update: mocks.update }, homePagePlacement: { deleteMany: mocks.placements },
  }))
})

describe('course editor authorization and errors', () => {
  it('loads an instructor-owned course with empty optional notes and resources', async () => {
    const response = await GET(request(), params)
    expect(response.status).toBe(200)
    expect((await response.json()).course).toMatchObject({ id: 'course', notes: null, resources: [] })
  })

  it('allows Atlas Admins to load another creator’s course', async () => {
    mocks.user.mockResolvedValue({ id: 'admin', role: 'ATLAS_ADMIN', status: 'ACTIVE' })
    expect((await GET(request(), params)).status).toBe(200)
  })

  it.each(['other-instructor', null])('denies instructors access to courses owned by %s', async (createdById) => {
    mocks.course.mockResolvedValue({ ...course, createdById })
    expect((await GET(request(), params)).status).toBe(403)
    expect(mocks.resources).not.toHaveBeenCalled()
  })

  it('returns 401 for an absent session', async () => {
    mocks.auth.mockResolvedValue(null)
    expect((await GET(request(), params)).status).toBe(401)
  })

  it('returns 403 for a disabled account', async () => {
    mocks.user.mockResolvedValue({ id: 'instructor', role: 'INSTRUCTOR', status: 'DISABLED' })
    expect((await GET(request(), params)).status).toBe(403)
  })

  it('returns 404 only when the course is missing', async () => {
    mocks.course.mockResolvedValue(null)
    expect((await GET(request(), params)).status).toBe(404)
  })

  it('reports a database failure as 500', async () => {
    mocks.course.mockRejectedValue(new Error('Database unavailable'))
    const response = await GET(request(), params)
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Unable to load course' })
  })

  it('keeps the required course available when optional resources fail', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.resources.mockRejectedValue(new Error('Optional table unavailable'))
    try {
      const response = await GET(request(), params)
      expect(response.status).toBe(200)
      expect((await response.json()).course.resources).toEqual([])
    } finally { warning.mockRestore() }
  })
})

describe('course updates and placement cleanup', () => {
  it('does not unpublish an instructor’s course when only notes change', async () => {
    const response = await PATCH(request({ notes: 'Updated notes' }), params)
    expect(response.status).toBe(200)
    expect(mocks.update.mock.calls[0][0].data).toEqual({ notes: 'Updated notes' })
    expect((await response.json()).course.published).toBe(true)
  })

  it('denies instructor publication and permanent deletion', async () => {
    expect((await PATCH(request({ status: 'PUBLISHED' }), params)).status).toBe(403)
    expect((await DELETE(request(), params)).status).toBe(403)
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.delete).not.toHaveBeenCalled()
  })

  it('removes homepage placements in the same transaction when archived', async () => {
    mocks.user.mockResolvedValue({ id: 'admin', role: 'ATLAS_ADMIN', status: 'ACTIVE' })
    expect((await PATCH(request({ status: 'ARCHIVED' }), params)).status).toBe(200)
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: 'course' }, data: { status: 'ARCHIVED', published: false } })
    expect(mocks.placements).toHaveBeenCalledWith({ where: { courseId: 'course' } })
  })
})
