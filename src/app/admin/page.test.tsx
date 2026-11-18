// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdminCourse } from '@/types/api'
import AdminDashboardPage from './page'

const { sessionMock, router } = vi.hoisted(() => ({ sessionMock: vi.fn(), router: { push: vi.fn() } }))
vi.mock('next-auth/react', () => ({ useSession: sessionMock }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))
vi.mock('@/components/AdminShell', () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }))
vi.mock('@/components/CourseCard', () => ({ default: ({ course, onClick }: { course: { title: string }; onClick: () => void }) => <button type="button" onClick={onClick}>{course.title}</button> }))

const user = { id: 'admin-a', role: 'ATLAS_ADMIN', name: 'Verification admin', email: 'admin@example.invalid' }
const courses: AdminCourse[] = Array.from({ length: 18 }, (_, index) => ({ id: `course-${index}`, slug: `course-${index}`, title: `Published course ${index + 1}`, description: '', durationMinutes: 10, published: true, muxPlaybackId: null, sectionId: null, section: null, schoolAccessCount: 1, progressCount: 0, createdAt: '2026-11-18T00:00:00Z' }))
const analytics = { activeSchools: 1, totalSchools: 1, totalTeachers: 3, totalHeadteachers: 1, totalCourses: 18, publishedCourses: 18, activeInvitations: 0, totalCompletions: 0, totalLearningMinutes: 0, incompleteCourses: [] }
const response = (body: unknown) => ({ ok: true, json: async () => body })
const pageResponse = (page: number) => response({ courses: courses.slice((page - 1) * 12, page * 12), pagination: { page, pageSize: 12, total: 18, totalPages: 2 } })
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  sessionMock.mockReturnValue({ status: 'authenticated', data: { user, expires: '2027-01-01T00:00:00Z' } })
  fetchMock = vi.fn(async (input: RequestInfo | URL) => String(input) === '/api/admin/analytics' ? response(analytics) : pageResponse(new URL(String(input), 'http://localhost').searchParams.get('page') === '2' ? 2 : 1))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('admin overview loading', () => {
  it('keeps the published courses visible when session refresh returns an equivalent account', async () => {
    const { rerender } = render(<AdminDashboardPage />)
    await screen.findByRole('button', { name: 'Published course 1' })
    const courseRequests = () => fetchMock.mock.calls.filter(([url]) => String(url).startsWith('/api/admin/courses')).length
    expect(courseRequests()).toBe(1)

    sessionMock.mockReturnValue({ status: 'authenticated', data: { user: { ...user }, expires: '2027-01-02T00:00:00Z' } })
    await act(async () => { rerender(<AdminDashboardPage />) })

    expect(screen.getByRole('button', { name: 'Published course 1' })).toBeInTheDocument()
    expect(screen.queryByText('Loading courses...')).not.toBeInTheDocument()
    expect(courseRequests()).toBe(1)
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/admin/analytics')).toHaveLength(1)
  })

  it('retains the loaded cards while View more fetches the next published course page', async () => {
    let finishMore: (value: ReturnType<typeof pageResponse>) => void = () => {}
    const more = new Promise<ReturnType<typeof pageResponse>>(resolve => { finishMore = resolve })
    fetchMock.mockImplementation((input: RequestInfo | URL) => String(input) === '/api/admin/analytics' ? Promise.resolve(response(analytics)) : String(input).includes('page=2') ? more : Promise.resolve(pageResponse(1)))
    render(<AdminDashboardPage />)
    await screen.findByRole('button', { name: 'Published course 1' })
    fireEvent.click(screen.getByRole('button', { name: 'View more' }))

    expect(screen.getByRole('button', { name: 'Published course 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Published course 12' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Loading courses…' })).toBeDisabled()
    await act(async () => { finishMore(pageResponse(2)) })
    expect(await screen.findByRole('button', { name: 'Published course 18' })).toBeInTheDocument()
    expect(screen.getByText('Showing 18 of 18 published courses')).toBeInTheDocument()
  })
})
