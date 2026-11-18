// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import HorizontalCourseList from './HorizontalCourseList'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function courseList(resetKey = 'all') {
  return <HorizontalCourseList label="Top courses" trackClassName="test-course-track" resetKey={resetKey}>
    {Array.from({ length: 7 }, (_, index) => <a key={index} href={`/course-${index}`}>Course {index + 1}</a>)}
  </HorizontalCourseList>
}

function setScrollableSize() {
  const track = screen.getByRole('region', { name: 'Top courses' })
  Object.defineProperties(track, { clientWidth: { value: 400 }, scrollWidth: { value: 1000 }, scrollLeft: { value: 0, writable: true } })
  const scrollBy = vi.fn((options?: ScrollToOptions | number, _y?: number) => {
    const left = typeof options === 'number' ? options : options?.left ?? 0
    track.scrollLeft = Math.max(0, Math.min(600, track.scrollLeft + left))
    fireEvent.scroll(track)
  })
  track.scrollBy = scrollBy
  fireEvent.scroll(track)
  return { track, scrollBy }
}

describe('horizontal course browsing', () => {
  it('keeps every course available and updates previous/next controls as the row scrolls', () => {
    render(courseList())
    const { track } = setScrollableSize()
    expect(screen.getAllByRole('link')).toHaveLength(7)
    expect(screen.getByRole('button', { name: 'Previous top courses' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Next top courses' }))
    expect(track.scrollLeft).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Previous top courses' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Next top courses' }))
    expect(screen.getByRole('button', { name: 'Next top courses' })).toBeDisabled()
  })

  it('supports arrow-key browsing without intercepting a child link keyboard event', () => {
    render(courseList())
    const { track, scrollBy } = setScrollableSize()
    fireEvent.keyDown(track, { key: 'ArrowRight' })
    expect(track.scrollLeft).toBeGreaterThan(0)
    fireEvent.keyDown(screen.getByRole('link', { name: 'Course 1' }), { key: 'ArrowRight' })
    expect(scrollBy).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(track, { key: 'ArrowLeft' })
    expect(track.scrollLeft).toBe(0)
  })

  it('preserves the scroll position during unrelated rerenders and resets it for a new category', () => {
    const { rerender } = render(courseList())
    const { track } = setScrollableSize()
    fireEvent.click(screen.getByRole('button', { name: 'Next top courses' }))
    const position = track.scrollLeft
    rerender(courseList())
    expect(track.scrollLeft).toBe(position)
    rerender(courseList('safeguarding'))
    expect(track.scrollLeft).toBe(0)
  })

  it('respects reduced-motion preferences when browsing', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    render(courseList())
    const { scrollBy } = setScrollableSize()
    fireEvent.click(screen.getByRole('button', { name: 'Next top courses' }))
    expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }))
  })
})
