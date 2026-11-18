// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdminCourse } from '@/types/api'
import PublishedCourseGrid from './PublishedCourseGrid'

vi.mock('@/components/CourseCard', () => ({ default: ({ course, onClick }: { course: { title: string }; onClick: () => void }) => <button type="button" onClick={onClick}>{course.title}</button> }))

const originalWidth = window.innerWidth
const courses: AdminCourse[] = Array.from({ length: 18 }, (_, index) => ({ id: `course-${index}`, slug: `course-${index}`, title: `Published course ${index + 1}`, description: '', durationMinutes: 10, published: true, muxPlaybackId: null, sectionId: null, section: null, schoolAccessCount: 1, progressCount: 0, createdAt: '2026-11-18T00:00:00Z' }))

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { value: 1440, configurable: true, writable: true })
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 1100, height: 600, top: 0, left: 0, right: 1100, bottom: 600, x: 0, y: 0, toJSON: () => ({}) })
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); Object.defineProperty(window, 'innerWidth', { value: originalWidth, configurable: true, writable: true }) })

describe('admin published courses', () => {
  it('initially shows two desktop rows, reveals remaining courses, and can collapse again', () => {
    const onLoadMore = vi.fn()
    const props = { courses: courses.slice(0, 12), total: 18, loading: false, error: '', onLoadMore, onPreview: vi.fn(), onEdit: vi.fn() }
    const { rerender } = render(<PublishedCourseGrid {...props} />)
    expect(screen.getAllByRole('button', { name: /^Published course / })).toHaveLength(8)
    fireEvent.click(screen.getByRole('button', { name: 'View more' }))
    expect(onLoadMore).toHaveBeenCalledTimes(1)
    expect(screen.getAllByRole('button', { name: /^Published course / })).toHaveLength(12)
    rerender(<PublishedCourseGrid {...props} courses={courses} />)
    expect(screen.getAllByRole('button', { name: /^Published course / })).toHaveLength(18)
    expect(screen.queryByRole('button', { name: 'View more' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'View less' }))
    expect(screen.getAllByRole('button', { name: /^Published course / })).toHaveLength(8)
  })

  it('keeps loaded cards visible while more courses load or a request fails', () => {
    const props = { courses: courses.slice(0, 12), total: 18, loading: true, error: '', onLoadMore: vi.fn(), onPreview: vi.fn(), onEdit: vi.fn() }
    const { rerender } = render(<PublishedCourseGrid {...props} />)
    expect(screen.getAllByRole('button', { name: /^Published course / })).toHaveLength(8)
    expect(screen.getByRole('button', { name: 'Loading courses…' })).toBeDisabled()
    rerender(<PublishedCourseGrid {...props} loading={false} error="Unable to load more courses" />)
    expect(screen.getAllByRole('button', { name: /^Published course / })).toHaveLength(8)
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load more courses')
  })

  it('does not collapse the initial mobile course list', () => {
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true, writable: true })
    render(<PublishedCourseGrid courses={courses.slice(0, 12)} total={18} loading={false} error="" onLoadMore={vi.fn()} onPreview={vi.fn()} onEdit={vi.fn()} />)
    expect(screen.getAllByRole('button', { name: /^Published course / })).toHaveLength(12)
  })
})
