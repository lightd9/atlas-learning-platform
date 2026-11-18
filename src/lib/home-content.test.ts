import { describe, it, expect } from 'vitest'
import {
  HOME_SECTION_LIMITS,
  canActivateHomePlacement,
  countActiveHomePlacements,
  getVisibleHomePlacements,
  isPublicHomeCourse,
  serializeHomeContent,
} from '@/lib/home-content'

function placement(overrides: Record<string, unknown> = {}) {
  return {
    id: `placement-${Math.random()}`,
    section: 'RECOMMENDED',
    sortOrder: 0,
    course: {
      id: 'course-1',
      title: 'Introduction to AI',
      description: 'A public course',
      coverImageUrl: null,
      durationMinutes: 10,
      muxPlaybackId: 'secret-playback-id',
      section: { name: 'Technology' },
      published: true,
      status: 'PUBLISHED',
      audience: 'STAFF',
    },
    ...overrides,
  }
}

describe('HOME_SECTION_LIMITS', () => {
  it('allows more than three videos in highlighted homepage sections', () => {
    expect(HOME_SECTION_LIMITS.RECOMMENDED).toBeGreaterThan(3)
    expect(HOME_SECTION_LIMITS.UNLOCK_SOMETHING_NEW).toBeGreaterThan(3)
  })
})

describe('canActivateHomePlacement', () => {
  it('rejects reactivating an inactive placement when a limited section is full', () => {
    expect(canActivateHomePlacement({
      section: 'RECOMMENDED',
      active: true,
      existingActive: false,
      activeCount: HOME_SECTION_LIMITS.RECOMMENDED,
    })).toBe(false)
  })

  it('allows reactivating an already active placement and deactivating any placement', () => {
    expect(canActivateHomePlacement({
      section: 'RECOMMENDED',
      active: true,
      existingActive: true,
      activeCount: HOME_SECTION_LIMITS.RECOMMENDED,
    })).toBe(true)
    expect(canActivateHomePlacement({
      section: 'UNLOCK_SOMETHING_NEW',
      active: false,
      existingActive: true,
      activeCount: HOME_SECTION_LIMITS.UNLOCK_SOMETHING_NEW,
    })).toBe(true)
  })

  it('allows new placements below the limit and unlimited sections', () => {
    expect(canActivateHomePlacement({
      section: 'RECOMMENDED',
      active: true,
      existingActive: false,
      activeCount: HOME_SECTION_LIMITS.RECOMMENDED - 1,
    })).toBe(true)
    expect(canActivateHomePlacement({
      section: 'EXPLORE',
      active: true,
      existingActive: false,
      activeCount: 100,
    })).toBe(true)
  })
})

describe('isPublicHomeCourse', () => {
  it('allows published Staff only and Parents + staff course cards on the public site', () => {
    expect(isPublicHomeCourse({ published: true, status: 'PUBLISHED', audience: 'STAFF' })).toBe(true)
    expect(isPublicHomeCourse({ published: true, status: 'PUBLISHED', audience: 'PARENT' })).toBe(true)
    expect(isPublicHomeCourse({ published: true, status: 'DRAFT', audience: 'STAFF' })).toBe(false)
    expect(isPublicHomeCourse({ published: false, status: 'PUBLISHED', audience: 'STAFF' })).toBe(false)
  })
})

describe('getVisibleHomePlacements', () => {
  it('omits placements whose course is missing or no longer eligible for the public site', () => {
    const placements = [
      placement({ id: 'valid', course: { published: true, status: 'PUBLISHED', audience: 'STAFF' } }),
      placement({ id: 'missing-course', course: null }),
      placement({ id: 'unpublished', course: { published: false, status: 'PUBLISHED', audience: 'STAFF' } }),
      placement({ id: 'draft', course: { published: true, status: 'DRAFT', audience: 'STAFF' } }),
      placement({ id: 'parent', course: { published: true, status: 'PUBLISHED', audience: 'PARENT' } }),
    ]

    type TestPlacement = { id: string; course?: { published?: boolean; status?: string; audience?: string } | null }
    expect(getVisibleHomePlacements(placements as TestPlacement[]).map((item) => item.id)).toEqual(['valid', 'parent'])
  })
})

describe('countActiveHomePlacements', () => {
  it('counts only active placements with an eligible course', () => {
    const placements = [
      placement({ id: 'active-valid', active: true }),
      placement({ id: 'inactive-valid', active: false }),
      placement({ id: 'active-parent', active: true, course: { published: true, status: 'PUBLISHED', audience: 'PARENT' } }),
      placement({ id: 'active-invalid', active: true, course: { published: false, status: 'PUBLISHED', audience: 'STAFF' } }),
      placement({ id: 'active-missing', active: true, course: null }),
    ]

    expect(countActiveHomePlacements(placements as never)).toBe(2)
  })
})

describe('serializeHomeContent', () => {
  it('groups placements, applies the section limit, and never exposes the Mux playback id', () => {
    const placements = Array.from({ length: 20 }, (_, index) => placement({ sortOrder: index }))
    const grouped = serializeHomeContent(placements as never)

    expect(grouped.RECOMMENDED).toHaveLength(HOME_SECTION_LIMITS.RECOMMENDED)
    expect(grouped.TOP_COURSES).toHaveLength(0)
    expect(grouped.RECOMMENDED[0]).not.toHaveProperty('muxPlaybackId')
    expect(grouped.RECOMMENDED[0]).toMatchObject({ placementId: expect.any(String), sortOrder: 0 })
  })

  it('drops placements whose course is not eligible for the public site', () => {
    const grouped = serializeHomeContent([
      placement({ course: { id: 'ok', title: 'Ok', published: true, status: 'PUBLISHED', audience: 'STAFF' } }),
      placement({ course: { id: 'parent', title: 'Parent', published: true, status: 'PUBLISHED', audience: 'PARENT' } }),
      placement({ course: { id: 'draft', title: 'Draft', published: false, status: 'DRAFT', audience: 'PARENT' } }),
      placement({ course: { id: 'archived', title: 'Archived', published: false, status: 'ARCHIVED', audience: 'STAFF' } }),
    ] as never)
    expect(grouped.RECOMMENDED).toHaveLength(2)
    expect(grouped.RECOMMENDED[0]).toMatchObject({ id: 'ok' })
  })

  it('shows all five recommendations and seven top courses when both audiences are placed', () => {
    const recommendations = Array.from({ length: 5 }, (_, index) => placement({
      course: { id: `recommended-${index}`, published: true, status: 'PUBLISHED', audience: index === 3 ? 'PARENT' : 'STAFF', muxPlaybackId: 'private-video' },
    }))
    const top = Array.from({ length: 7 }, (_, index) => placement({
      section: 'TOP_COURSES',
      course: { id: `top-${index}`, published: true, status: 'PUBLISHED', audience: index >= 4 ? 'PARENT' : 'STAFF', muxPlaybackId: 'private-video' },
    }))
    const grouped = serializeHomeContent([...recommendations, ...top] as never)
    expect(grouped.RECOMMENDED).toHaveLength(5)
    expect(grouped.TOP_COURSES).toHaveLength(7)
    for (const course of [...grouped.RECOMMENDED, ...grouped.TOP_COURSES]) expect(course).not.toHaveProperty('muxPlaybackId')
  })
})
