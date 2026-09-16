'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'

interface CourseMarqueeProps {
  children: ReactNode
  previousLabel?: string
  nextLabel?: string
  style?: CSSProperties
}

export default function CourseMarquee({ children, previousLabel = 'Previous courses', nextLabel = 'Next courses', style }: CourseMarqueeProps) {
  const marqueeRef = useRef<HTMLDivElement>(null)
  const [canScroll, setCanScroll] = useState({ left: false, right: false })

  const updateScrollState = useCallback(() => {
    const marquee = marqueeRef.current
    if (!marquee) return
    setCanScroll({
      left: marquee.scrollLeft > 1,
      right: marquee.scrollLeft < marquee.scrollWidth - marquee.clientWidth - 1,
    })
  }, [])

  useEffect(() => {
    const marquee = marqueeRef.current
    if (!marquee) return
    updateScrollState()
    marquee.addEventListener('scroll', updateScrollState, { passive: true })
    window.addEventListener('resize', updateScrollState)
    return () => {
      marquee.removeEventListener('scroll', updateScrollState)
      window.removeEventListener('resize', updateScrollState)
    }
  }, [updateScrollState])

  const scrollByCard = (dir: 1 | -1) => {
    const marquee = marqueeRef.current
    if (!marquee) return
    const card = marquee.querySelector<HTMLElement>('.course-marquee-item')
    const step = card ? card.offsetWidth + 20 : 300
    marquee.scrollBy({ left: dir * step, behavior: 'smooth' })
  }

  return (
    <div className="course-marquee-wrap" style={style}>
      <div className="course-marquee" ref={marqueeRef}>
        <div className="course-marquee-track">{children}</div>
      </div>
      <div className="course-marquee-controls">
        <button type="button" aria-label={previousLabel} disabled={!canScroll.left} onClick={() => scrollByCard(-1)}><ArrowLeft size={15} /></button>
        <button type="button" aria-label={nextLabel} disabled={!canScroll.right} onClick={() => scrollByCard(1)}><ArrowRight size={15} /></button>
      </div>
    </div>
  )
}