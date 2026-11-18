import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ manager: vi.fn(), placements: vi.fn(), existing: vi.fn(), course: vi.fn(), upsert: vi.fn() }))
vi.mock('@/lib/access', () => ({ requireHomeContentManager: mocks.manager }))
vi.mock('@/lib/prisma', () => ({ prisma: {
  homePagePlacement: { findMany: mocks.placements, findUnique: mocks.existing, upsert: mocks.upsert },
  course: { findFirst: mocks.course },
} }))
import { GET } from '@/app/api/public/home-content/route'
import { POST } from '@/app/api/admin/home-content/route'

const makePlacements = (section: string, total: number, parents: number) => Array.from({ length: total }, (_, index) => ({
  id: `${section}-${index}`, courseId: `${section}-course-${index}`, section, active: true, sortOrder: index,
  course: { id: `${section}-course-${index}`, title: `Course ${index}`, published: true, status: 'PUBLISHED', audience: index < parents ? 'PARENT' : 'STAFF', muxPlaybackId: 'private-playback' },
}))

beforeEach(() => {
  vi.resetAllMocks()
  mocks.manager.mockResolvedValue({ id: 'admin', role: 'ATLAS_ADMIN' })
  mocks.existing.mockResolvedValue(null)
  const placements = [...makePlacements('RECOMMENDED', 5, 1), ...makePlacements('TOP_COURSES', 7, 3)]
  mocks.placements.mockImplementation(async ({ where } = {}) => placements.filter(placement =>
    (!where?.section || placement.section === where.section) &&
    (!where?.course?.audience || placement.course.audience === where.course.audience),
  ))
  mocks.course.mockImplementation(async ({ where }) => where.audience === 'STAFF' ? null : { id: 'parent', audience: 'PARENT', published: true, status: 'PUBLISHED' })
  mocks.upsert.mockResolvedValue({ id: 'new-placement', courseId: 'parent', section: 'TOP_COURSES', active: true })
})

describe('homepage course audiences', () => {
  it('returns all five recommendations and seven top courses without publishing video IDs', async () => {
    const response = await GET()
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.RECOMMENDED).toHaveLength(5)
    expect(body.TOP_COURSES).toHaveLength(7)
    expect(body.TOP_COURSES.filter((course: { audience: string }) => course.audience === 'PARENT')).toHaveLength(3)
    for (const course of [...body.RECOMMENDED, ...body.TOP_COURSES]) expect(course).not.toHaveProperty('muxPlaybackId')
  })

  it('allows a homepage manager to place a published Parents + staff course', async () => {
    const response = await POST(new Request('http://localhost/api/admin/home-content', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courseId: 'parent', section: 'TOP_COURSES' }) }))
    expect(response.status).toBe(201)
    expect((await response.json()).placement.courseId).toBe('parent')
  })

  it('still requires management permission before placing any course', async () => {
    mocks.manager.mockRejectedValue(new Error('FORBIDDEN'))
    expect((await POST(new Request('http://localhost/api/admin/home-content', { method: 'POST', body: '{}' }))).status).toBe(403)
    expect(mocks.upsert).not.toHaveBeenCalled()
  })
})
