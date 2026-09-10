'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useEffect } from 'react'
import { BookOpen, Search } from 'lucide-react'
import AuthShell from '@/components/AuthShell'
import CourseCard from '@/components/CourseCard'
import type { ApiCourse } from '@/types/api'

function mapCourse(c: ApiCourse, index: number) {
  const tones = ['blue', 'mint', 'lilac', 'peach', 'violet']
  const p = c.progress?.[0]
  const mins = c.durationMinutes
  const lessons = Math.max(1, Math.round(mins / 6))
  return {
    id: c.id,
    title: c.title,
    label: c.description?.slice(0, 30) || 'Course',
    duration: mins < 60 ? `${mins} min` : `${Math.floor(mins / 6)}h ${mins % 60 ? ` ${mins % 60}m` : ''}`,
    lessons: `${lessons} lessons`,
    tone: tones[index % tones.length],
    progress: p ? Math.round(Number(p.percentComplete)) : 0,
    description: c.description,
    section: c.section,
  }
}

export default function CoursesPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [courses, setCourses] = useState<ApiCourse[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/courses').then((r) => r.json()).then((d) => { setCourses(d.courses ?? []); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const mapped = courses.map((c, i) => mapCourse(c, i))

  const filtered = useMemo(() => {
    let result = mapped
    if (search) result = result.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()))
    if (filter === 'in-progress') result = result.filter((c) => c.progress > 0 && c.progress < 100)
    if (filter === 'not-started') result = result.filter((c) => c.progress === 0)
    if (filter === 'completed') result = result.filter((c) => c.progress >= 100)
    return result
  }, [mapped, search, filter])

  return <AuthShell active="My learning">
    <div className="page-wrap">
      <div className="page-heading compact">
        <div>
          <p className="eyebrow">Learning library</p>
          <h1>Courses for your school</h1>
          <p className="muted">Clear, practical training for every member of your team.</p>
        </div>
        <div className="library-count"><BookOpen size={18} /><strong>{filtered.length}</strong><span>available courses</span></div>
      </div>
      <div className="filter-row">
        <div className="top-search" style={{ marginRight: 'auto', height: 40 }}>
          <Search size={16} />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search courses…" aria-label="Search courses" />
        </div>
        <button className={`filter ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All courses</button>
        <button className={`filter ${filter === 'in-progress' ? 'active' : ''}`} onClick={() => setFilter('in-progress')}>In progress</button>
        <button className={`filter ${filter === 'not-started' ? 'active' : ''}`} onClick={() => setFilter('not-started')}>Not started</button>
        <button className={`filter ${filter === 'completed' ? 'active' : ''}`} onClick={() => setFilter('completed')}>Completed</button>
      </div>
      {search && <p className="search-result">Showing results for &ldquo;{search}&rdquo;</p>}
      {loading
        ? <div className="library-grid">{[0, 1, 2].map((i) => <div key={i} className="course-card" style={{ height: 260, opacity: 0.4 }} />)}</div>
        : <div className="library-grid">{filtered.map((course, i) => <CourseCard key={course.id} course={course} index={i} onClick={() => router.push(`/courses/${course.id}`)} />)}</div>
      }
    </div>
  </AuthShell>
}
