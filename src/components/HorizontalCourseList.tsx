'use client'

import { useCallback, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function HorizontalCourseList({ children, label, className = '', trackClassName, resetKey }: {
  children: ReactNode
  label: string
  className?: string
  trackClassName: string
  resetKey: string
}) {
  const id = useId()
  const track = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ previous: false, next: false })
  const measure = useCallback(() => {
    const node = track.current
    if (!node) return
    const previous = node.scrollLeft > 2
    const next = node.scrollLeft + node.clientWidth < node.scrollWidth - 2
    setPosition(current => current.previous === previous && current.next === next ? current : { previous, next })
  }, [])

  useLayoutEffect(() => {
    const node = track.current
    if (!node) return
    node.scrollLeft = 0
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(node)
    window.addEventListener('resize', measure)
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure) }
  }, [measure, resetKey])

  function scroll(direction: -1 | 1) {
    const node = track.current
    if (!node) return
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    node.scrollBy({ left: direction * Math.max(1, Math.round(node.clientWidth * 0.85)), behavior: reducedMotion ? 'auto' : 'smooth' })
  }

  return <div className={`atlas-course-carousel ${className}`}>
    <div id={id} ref={track} className={trackClassName} role="region" aria-label={label} tabIndex={0} onScroll={measure} onKeyDown={event => {
      if (event.target !== event.currentTarget) return
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        scroll(event.key === 'ArrowLeft' ? -1 : 1)
      }
    }}>
      {children}
    </div>
    <div className="atlas-course-carousel-controls">
      <button type="button" aria-label={`Previous ${label.toLowerCase()}`} aria-controls={id} disabled={!position.previous} onClick={() => scroll(-1)}><ChevronLeft size={19} aria-hidden="true" /></button>
      <button type="button" aria-label={`Next ${label.toLowerCase()}`} aria-controls={id} disabled={!position.next} onClick={() => scroll(1)}><ChevronRight size={19} aria-hidden="true" /></button>
    </div>
  </div>
}
