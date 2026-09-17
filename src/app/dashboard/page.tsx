'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  BarChart3, BookOpen, ChevronRight, CheckCircle2, Clock3,
  MoreHorizontal, Play, Video, ArrowUpRight,
} from 'lucide-react'
import AuthShell from '@/components/AuthShell'
import CourseCard from '@/components/CourseCard'
import CourseMarquee from '@/components/CourseMarquee'
import type { ApiCourse } from '@/types/api'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDate() {
  return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function formatMinutes(mins: number) {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function mapCourse(c: ApiCourse, index: number) {
  const tones = ['blue', 'mint', 'lilac', 'peach', 'violet']
  const p = c.progress?.[0]
  const mins = c.durationMinutes
  const lessons = Math.max(1, Math.round(mins / 6))
  return {
    id: c.id,
    title: c.title,
    label: c.description?.slice(0, 30) || 'Course',
    duration: mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60 ? ` ${mins % 60}m` : ''}`,
    lessons: `${lessons} lessons`,
    tone: tones[index % tones.length],
    progress: p ? Math.round(Number(p.percentComplete)) : 0,
    description: c.description,
  }
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [courses, setCourses] = useState<ApiCourse[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'ATLAS_ADMIN') {
      router.replace('/admin')
      return
    }
    if (status === 'authenticated' && session?.user?.role === 'INSTRUCTOR') {
      router.replace('/admin/courses')
      return
    }
    fetch('/api/courses').then((r) => r.json()).then((d) => { setCourses(d.courses ?? []); setLoading(false) }).catch(() => setLoading(false))
  }, [status, session?.user?.role, router])

  const firstName = session?.user?.name?.split(' ')[0] || 'there'
  const mapped = courses.map((c, i) => mapCourse(c, i))

  const activity = courses
    .filter((c) => c.progress && c.progress.length > 0 && c.progress[0]?.status !== 'NOT_STARTED')
    .map((c) => {
      const p = c.progress![0]
      const isRecent = p.lastWatchedAt && (Date.now() - new Date(p.lastWatchedAt).getTime() < 48 * 60 * 60 * 1000)
      const action = p.status === 'COMPLETED' ? 'Completed' : p.watchedSeconds > 0 ? 'Continued watching' : 'Started course'
      const when = p.lastWatchedAt ? formatWhen(p.lastWatchedAt) : '—'
      return { name: c.title, when, action, progress: Math.round(Number(p.percentComplete)), color: p.status === 'COMPLETED' ? 'blue' : 'mint' }
    })
    .slice(0, 5)

  const totalMinutes = courses.reduce((sum, c) => {
    const p = c.progress?.[0]
    return sum + (p ? Math.round(p.watchedSeconds / 60) : 0)
  }, 0)

  const weekBars = (() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      d.setHours(0, 0, 0, 0)
      return d.getTime()
    })
    const values = days.map(() => 0)
    courses.forEach((c) => {
      const p = c.progress?.[0]
      if (!p || !p.lastWatchedAt) return
      const time = new Date(p.lastWatchedAt).getTime()
      const index = days.findIndex((d) => time >= d && time < d + 86400000)
      if (index >= 0) values[index] += p.watchedSeconds / 60
    })
    const max = Math.max(...values, 1)
    return values.map((v) => Math.max(6, Math.round((v / max) * 100)))
  })()

  const todayIndex = (new Date().getDay() + 6) % 7

  const coursesInProgress = mapped.filter((c) => c.progress > 0).length || courses.length

  const continueCourse = courses
    .filter((c) => c.progress && c.progress[0]?.status === 'IN_PROGRESS')
    .sort((a, b) => (b.progress![0]?.lastWatchedAt ? new Date(b.progress![0].lastWatchedAt!).getTime() : 0) - (a.progress![0]?.lastWatchedAt ? new Date(a.progress![0].lastWatchedAt!).getTime() : 0))[0]

  return <AuthShell active="Overview">
    <div className="page-wrap">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{formatDate()}</p>
          <h1>{getGreeting()}, {firstName} <span className="wave">✦</span></h1>
          <p className="muted">Keep building your team&apos;s digital confidence, one lesson at a time.</p>
        </div>
        <Link className="primary-button" href="/courses">Explore learning <ArrowUpRight size={17} /></Link>
      </div>

      <section className="hero-card">
        <div className="hero-copy">
          <span className="tag tag-light">Your learning journey</span>
          <h2>Small steps.<br /><em>Real confidence.</em></h2>
          <p>Practical training designed to fit around the busy rhythm of school life.</p>
          {continueCourse
            ? <Link className="hero-button" href={`/courses/${continueCourse.id}`}>Continue learning <Play size={14} fill="currentColor" /></Link>
            : <Link className="hero-button" href="/courses">Start learning <Play size={14} fill="currentColor" /></Link>
          }
        </div>
        <div className="hero-orbit">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="hero-symbol"><img src="/metric-school2.png" alt="" className="hero-symbol-img" /></div>
          <span className="float-note note-one"><CheckCircle2 size={15} /> Progress saved</span>
          <span className="float-note note-two"><Video size={14} /> {coursesInProgress} courses</span>
        </div>
      </section>

      <div className="section-head">
        <div><p className="eyebrow">Keep going</p><h2>Pick up where you left off</h2></div>
        <Link className="text-button" href="/courses">View all courses <ChevronRight size={16} /></Link>
      </div>

      {loading
        ? <div className="course-grid">{[0, 1, 2].map((i) => <div key={i} className="course-card" style={{ height: 260, opacity: 0.4 }} />)}</div>
        : mapped.length > 0
          ? <CourseMarquee>{mapped.map((course, i) => <div key={course.id} className="course-marquee-item"><CourseCard course={course} index={i} onClick={() => router.push(`/courses/${course.id}`)} /></div>)}</CourseMarquee>
          : <div className="panel" style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>No courses available yet.</div>
      }

      <div className="dashboard-lower">
        <section className="panel activity-panel">
          <div className="panel-head">
            <div><p className="eyebrow">Your activity</p><h3>Recent learning</h3></div>
            <button className="icon-button"><MoreHorizontal size={20} /></button>
          </div>
          {activity.length === 0
            ? <p className="muted" style={{ padding: 20 }}>No activity yet. Start a course to see your progress here.</p>
            : activity.map((item) => (
              <div className="activity-row" key={item.name}>
                <div className={`activity-icon ${item.color}`}><Play size={14} fill="currentColor" /></div>
                <div className="activity-info">
                  <strong>{item.name}</strong>
                  <span>{item.action} · {item.when}</span>
                  <div className="mini-progress"><span style={{ width: `${item.progress}%` }} /></div>
                </div>
                <span className="progress-number">{item.progress}%</span>
              </div>
            ))
          }
        </section>

        <section className="panel stat-panel">
          <div className="panel-head">
            <div><p className="eyebrow">This month</p><h3>Learning snapshot</h3></div>
            <BarChart3 size={20} className="muted-icon" />
          </div>
          <div className="snapshot-stat"><strong>{formatMinutes(totalMinutes)}</strong><span>Total learning time</span></div>
          <div className="snapshot-bars">
            {weekBars.map((height, i) => (
              <span key={i} className={i === todayIndex ? 'today' : ''} style={{ height: `${height}%` }} />
            ))}
          </div>
          <div className="days"><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span></div>
        </section>
      </div>
    </div>
  </AuthShell>
}

function formatWhen(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)
  if (diffMin < 60) return `${diffMin} min ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay === 1) return 'Yesterday'
  if (diffDay < 7) return `${diffDay} days ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
