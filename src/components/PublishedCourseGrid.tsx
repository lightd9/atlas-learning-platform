'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import CourseCard from '@/components/CourseCard'
import { courseTotalSeconds, formatClock } from '@/lib/format'
import type { AdminCourse } from '@/types/api'

const tones = ['blue', 'mint', 'lilac', 'peach', 'violet'] as const

export default function PublishedCourseGrid({ courses, total, loading, error, onLoadMore, onPreview, onEdit }: {
  courses: AdminCourse[]
  total: number
  loading: boolean
  error: string
  onLoadMore: () => void
  onPreview: (id: string) => void
  onEdit: (id: string) => void
}) {
  const grid = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState({ desktop: true, columns: 3 })
  const [expanded, setExpanded] = useState(false)

  useLayoutEffect(() => {
    const node = grid.current
    if (!node) return
    const measure = () => {
      const desktop = window.innerWidth > 760
      const width = node.getBoundingClientRect().width
      setLayout(current => {
        const columns = width > 0 ? Math.max(1, Math.floor((width + 16) / (260 + 16))) : current.columns
        return current.desktop === desktop && current.columns === columns ? current : { desktop, columns }
      })
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(node)
    window.addEventListener('resize', measure)
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure) }
  }, [])

  const visibleCourses = layout.desktop && !expanded ? courses.slice(0, layout.columns * 2) : courses
  const hasMore = visibleCourses.length < total

  function viewMore() {
    setExpanded(true)
    if (courses.length < total) onLoadMore()
  }

  return <>
    <div ref={grid} id="admin-published-courses" className="admin-course-tile-grid admin-published-course-grid" aria-busy={loading}>
      {visibleCourses.map((course, index) => <div key={course.id} className="admin-course-tile">
        <CourseCard showProgress={false} course={{ id: course.id, title: course.title, description: course.description, coverImageUrl: course.coverImageUrl, label: course.section?.name ?? 'Course', duration: formatClock(courseTotalSeconds(course)), lessons: `${course.moduleCount ?? 0} modules`, tone: tones[index % tones.length], progress: 0 }} index={index} onClick={() => onPreview(course.id)} />
        <div className="admin-published-course-actions"><span className="badge badge-active">Published</span><button type="button" className="text-button" onClick={() => onEdit(course.id)}>Edit course</button></div>
      </div>)}
    </div>
    {error && <p role="alert" className="admin-published-course-error">{error}</p>}
    <div className="admin-published-course-footer">
      <span className="muted" role="status">Showing {visibleCourses.length} of {total} published courses</span>
      <div className="admin-published-course-controls">
        {layout.desktop && expanded && courses.length > layout.columns * 2 && <button type="button" className="text-button" aria-controls="admin-published-courses" aria-expanded={expanded} onClick={() => setExpanded(false)}>View less</button>}
        {hasMore && <button type="button" className="secondary-button" aria-controls="admin-published-courses" aria-expanded={expanded} onClick={viewMore} disabled={loading}>{loading ? 'Loading courses…' : 'View more'}<ChevronDown size={16} aria-hidden="true" /></button>}
      </div>
    </div>
  </>
}
