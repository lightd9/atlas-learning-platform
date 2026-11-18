'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Plus, BarChart3, AlertTriangle, Eye, FileEdit, CheckCircle2, BookOpen } from 'lucide-react'
import AdminShell from '@/components/AdminShell'
import Metric from '@/components/Metric'
import CourseCard from '@/components/CourseCard'
import PublishedCourseGrid from '@/components/PublishedCourseGrid'
import { courseTotalSeconds, formatClock } from '@/lib/format'
import type { AdminCourse } from '@/types/api'

export default function AdminDashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [coursePage, setCoursePage] = useState(1)
  const [overviewCourses, setOverviewCourses] = useState<AdminCourse[]>([])
  const [coursePagination, setCoursePagination] = useState({ total: 0, totalPages: 0 })
  const [coursesLoading, setCoursesLoading] = useState(true)
  const [courseError, setCourseError] = useState('')
  const moreCourseRequest = useRef<AbortController | null>(null)
  const userId = session?.user?.id
  const userRole = session?.user?.role

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated' && userRole !== 'ATLAS_ADMIN' && userRole !== 'ATLAS_EMPLOYEE' && userRole !== 'INSTRUCTOR') { router.push('/dashboard'); return }
    if (status === 'authenticated') {
      const controller = new AbortController()
      const endpoint = userRole === 'INSTRUCTOR' ? '/api/admin/courses' : '/api/admin/analytics'
      setLoading(true)
      setLoadError('')
      fetch(endpoint, { signal: controller.signal }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error ?? 'Unable to load overview'); return d }).then((d) => { if (!controller.signal.aborted) setData(d) }).catch((error) => { if (!controller.signal.aborted) setLoadError(error.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
      return () => controller.abort()
    }
  }, [status, userId, userRole, router])

  useEffect(() => {
    if (status !== 'authenticated' || !['ATLAS_ADMIN', 'ATLAS_EMPLOYEE'].includes(userRole ?? '')) return
    const controller = new AbortController()
    moreCourseRequest.current?.abort()
    setCoursePage(1)
    setOverviewCourses([])
    setCoursesLoading(true)
    setCourseError('')
    fetch('/api/admin/courses?status=PUBLISHED&page=1&pageSize=12', { signal: controller.signal })
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error ?? 'Unable to load courses'); return body })
      .then((body) => { if (!controller.signal.aborted) { setOverviewCourses(body.courses ?? []); setCoursePagination(body.pagination) } })
      .catch((error) => { if (!controller.signal.aborted) setCourseError(error.message) })
      .finally(() => { if (!controller.signal.aborted) setCoursesLoading(false) })
    return () => { controller.abort(); moreCourseRequest.current?.abort() }
  }, [status, userId, userRole])

  async function loadMoreCourses() {
    if (coursesLoading || coursePage >= coursePagination.totalPages) return
    const controller = new AbortController()
    moreCourseRequest.current = controller
    const nextPage = coursePage + 1
    setCoursesLoading(true)
    setCourseError('')
    try {
      const response = await fetch(`/api/admin/courses?status=PUBLISHED&page=${nextPage}&pageSize=12`, { signal: controller.signal })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'Unable to load more courses')
      if (controller.signal.aborted) return
      setOverviewCourses(current => {
        const ids = new Set(current.map(course => course.id))
        return [...current, ...(body.courses ?? []).filter((course: AdminCourse) => !ids.has(course.id))]
      })
      setCoursePagination(body.pagination)
      setCoursePage(nextPage)
    } catch (error) { if (!controller.signal.aborted) setCourseError(error instanceof Error ? error.message : 'Unable to load more courses') }
    finally { if (!controller.signal.aborted) setCoursesLoading(false) }
  }

  if (status === 'loading' || loading) return <AdminShell active="overview"><div className="page-wrap"><p>Loading...</p></div></AdminShell>
  if (!data) return <AdminShell active="overview"><div className="page-wrap"><p role="alert">{loadError || 'Unable to load overview.'}</p></div></AdminShell>

  if (session?.user?.role === 'INSTRUCTOR') return <InstructorOverview courses={data.courses ?? []} router={router} />

  return <AdminShell active="overview">
    <div className="page-wrap">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Atlas Admin workspace</p>
          <h1>Platform overview</h1>
          <p className="muted">A clear snapshot of the schools, content and activity Atlas is managing.</p>
        </div>
        <div className="overview-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="secondary-button" onClick={() => router.push('/admin/schools')}><Plus size={16} /> Add school</button>
          <button className="primary-button" onClick={() => router.push('/admin/courses')}><Plus size={16} /> Create course</button>
        </div>
      </div>

      <div className="metric-grid admin-mobile-two-column" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 32 }}>
        <Metric iconClass="metric-icon-img" icon={<img src="/school-icon.png" alt="" className="metric-img" />} label="Active schools" value={String(data.activeSchools)} sublabel={`${data.totalSchools} registered`} />
        <Metric iconClass="metric-icon-img" icon={<img src="/person-icon.png" alt="" className="metric-img" />} label="Teachers" value={String(data.totalTeachers)} sublabel={`${data.totalHeadteachers} headteachers`} />
        <Metric iconClass="metric-icon-img" icon={<img src="/course-icon.png" alt="" className="metric-img" />} label="Courses" value={String(data.totalCourses)} sublabel={`${data.publishedCourses} published`} />
        <Metric iconClass="metric-icon-img" icon={<img src="/pending-icon.png" alt="" className="metric-img metric-img-lg" />} label="Pending invites" value={String(data.activeInvitations)} sublabel="Needs attention" />
      </div>

      <div className="section-head"><div><p className="eyebrow">Content pulse · {coursePagination.total} published</p><h2>Published courses</h2></div><button className="text-button" onClick={() => router.push('/admin/courses')}>View course management <Eye size={15} /></button></div>
      {overviewCourses.length > 0 ? <PublishedCourseGrid courses={overviewCourses} total={coursePagination.total} loading={coursesLoading} error={courseError} onLoadMore={loadMoreCourses} onPreview={id => router.push(`/admin/courses/${id}/preview`)} onEdit={id => router.push(`/admin/courses/${id}`)} /> : coursesLoading ? <p role="status" style={{ marginBottom: 24 }}>Loading courses...</p> : courseError ? <p role="alert" style={{ marginBottom: 24 }}>{courseError}</p> : <div className="panel" style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', marginBottom: 24 }}>No published courses yet.</div>}
      <div className="overview-lower-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
        <div className="panel"><div className="panel-head"><div><p className="eyebrow">Action queue</p><h3>Needs attention</h3></div><AlertTriangle size={20} color="var(--orange)" /></div><p className="muted">{data.activeInvitations} pending invitation{data.activeInvitations === 1 ? '' : 's'} across the platform.</p><p className="muted">{data.incompleteCourses?.length ?? 0} recent course{data.incompleteCourses?.length === 1 ? '' : 's'} need modules and lessons.</p><button className="text-button" onClick={() => router.push('/admin/courses')}>Review content</button></div>
        <div className="panel"><div className="panel-head"><div><p className="eyebrow">Learning activity</p><h3>Platform usage</h3></div><BarChart3 size={20} /></div><p className="muted">{data.totalCompletions} course completions and {Math.round(data.totalLearningMinutes / 60)} hours watched across all schools.</p><button className="text-button" onClick={() => router.push('/admin/analytics')}>Open analytics</button></div>
      </div>
    </div>
  </AdminShell>
}

const COURSE_TONES = ['blue', 'mint', 'lilac', 'peach', 'violet'] as const

const courseTileGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(260px, 100%), 1fr))',
  gap: 16,
  marginBottom: 24,
}

function InstructorOverview({ courses, router }: { courses: AdminCourse[]; router: ReturnType<typeof useRouter> }) {
  const drafts = courses.filter((course) => !course.published).length
  const totalLessons = courses.reduce((total, course) => total + (course.moduleCount ?? 0), 0)

  return <AdminShell active="overview">
    <div className="page-wrap">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Instructor workspace</p>
          <h1>Your course studio</h1>
          <p className="muted">Create, refine and prepare the learning content you own for Atlas schools.</p>
        </div>
        <button className="primary-button" onClick={() => router.push('/admin/courses')}><Plus size={17} /> Create course</button>
      </div>

      <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 30 }}>
        <Metric icon={<BookOpen size={20} />} label="Your courses" value={String(courses.length)} sublabel="Created by you" />
        <Metric icon={<FileEdit size={20} />} label="Drafts" value={String(drafts)} sublabel="Ready for refinement" />
        <Metric icon={<CheckCircle2 size={20} />} label="Course modules" value={String(totalLessons)} sublabel="Across your courses" />
      </div>

      <div className="section-head">
        <div><p className="eyebrow">Your content</p><h2>Courses you created</h2></div>
        <button className="text-button" onClick={() => router.push('/admin/courses')}>Open course management <Eye size={15} /></button>
      </div>

      {courses.length > 0 ? <div className="admin-course-tile-grid" style={{ ...courseTileGridStyle, marginBottom: 0 }}>{courses.map((course, index) => <div key={course.id} className="admin-course-tile">
        <CourseCard showProgress={false} course={{ id: course.id, title: course.title, description: course.description, label: course.section?.name ?? 'Course', duration: formatClock(courseTotalSeconds(course)), lessons: `${course.moduleCount ?? 0} modules`, tone: COURSE_TONES[index % COURSE_TONES.length], progress: 0 }} index={index} onClick={() => router.push(`/admin/courses/${course.id}`)} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 4px 0' }}><span className={`badge ${course.published ? 'badge-active' : 'badge-inactive'}`}>{course.published ? 'Published by Atlas' : 'Draft'}</span><button className="text-button" onClick={() => router.push(`/admin/courses/${course.id}`)}>Edit course</button></div>
      </div>)}</div> : <div className="panel" style={{ padding: 36, textAlign: 'center' }}><BookOpen size={28} color="var(--blue)" style={{ marginBottom: 10 }} /><h3>No courses yet</h3><p className="muted">Courses you create will appear here. Start with a title, description and learning structure.</p><button className="primary-button" onClick={() => router.push('/admin/courses')}><Plus size={16} /> Create your first course</button></div>}
    </div>
  </AdminShell>
}
