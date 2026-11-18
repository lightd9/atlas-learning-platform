import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ExplorePage from './page'

const { findPlacements } = vi.hoisted(() => ({ findPlacements: vi.fn() }))

vi.mock('@/lib/prisma', () => ({ prisma: { homePagePlacement: { findMany: findPlacements } } }))
vi.mock('@/components/PublicNavbar', () => ({ default: () => null }))
vi.mock('@/components/PublicFooter', () => ({ default: () => null }))
vi.mock('@/components/CourseCoverImage', () => ({ default: () => null }))
vi.mock('next/link', () => ({ default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a> }))

const parentTitle = 'What Information Are Apps Collecting About My Child?'
const placements = Array.from({ length: 5 }, (_, index) => ({
  id: `placement-${index}`,
  course: {
    id: `course-${index}`,
    title: index === 4 ? parentTitle : `Published staff course ${index + 1}`,
    description: 'A configured, published homepage course.',
    audience: index === 4 ? 'PARENT' : 'STAFF',
    durationMinutes: 10,
    coverImageUrl: null,
    section: { name: 'Course' },
  },
}))

beforeEach(() => {
  findPlacements.mockReset()
  // Emulate the database's audience predicate so a staff-only query reproduces
  // the production bug: five configured placements render as four cards.
  findPlacements.mockImplementation(({ where }: { where: { course: { audience?: string } } }) =>
    Promise.resolve(placements.filter(placement => !where.course.audience || placement.course.audience === where.course.audience)),
  )
})

describe('Explore homepage placements', () => {
  it('renders all five configured courses, including the parent course', async () => {
    const html = renderToStaticMarkup(await ExplorePage({ searchParams: Promise.resolve({}) }))

    expect(html.match(/class="atlas-course-card"/g) ?? []).toHaveLength(5)
    expect(html).toContain(`<h3>${parentTitle}</h3>`)
  })

  it('finds configured parent courses through public search', async () => {
    const html = renderToStaticMarkup(await ExplorePage({ searchParams: Promise.resolve({ q: 'apps collecting' }) }))

    expect(html.match(/class="atlas-course-card"/g) ?? []).toHaveLength(1)
    expect(html).toContain(`<h3>${parentTitle}</h3>`)
    expect(html).not.toContain('Nothing matched your search')
  })
})
