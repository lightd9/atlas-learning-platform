'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Plus, BarChart3, AlertTriangle, Eye, FileEdit, CheckCircle2, BookOpen } from 'lucide-react'
import AdminShell from '@/components/AdminShell'
import Metric from '@/components/Metric'
import CourseCard from '@/components/CourseCard'
import type { AdminCourse } from '@/types/api'

export default function AdminDashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated' && session?.user?.role !== 'ATLAS_ADMIN' && session?.user?.role !== 'INSTRUCTOR') { router.push('/dashboard'); return }
    if (status === 'authenticated') {
      const endpoint = session?.user?.role === 'INSTRUCTOR' ? '/api/admin/courses' : '/api/admin/analytics'
      fetch(endpoint).then((r) => r.json()).then((d) => { setData(d); setLoading(false) }).catch(() => setLoading(false))
    }
  }, [status, session, router])

  if (status === 'loading' || loading) return <AdminShell active="overview"><div className="page-wrap"><p>Loading...</p></div></AdminShell>
  if (!data) return null

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

      <div className="section-head"><div><p className="eyebrow">Content pulse</p><h2>Recent courses</h2></div><button className="text-button" onClick={() => router.push('/admin/courses')}>View course management <Eye size={15} /></button></div>
      {data.recentCourses?.length > 0 ? <div className="course-grid" style={{ marginBottom: 24 }}>{data.recentCourses.map((course: any, index: number) => <div key={course.id}>
        <CourseCard course={{ id: course.id, title: course.title, description: course.description, label: course.section?.name ?? 'Course', duration: `${course.durationMinutes} min`, lessons: `${course._count.modules} module${course._count.modules === 1 ? '' : 's'}`, tone: ['blue', 'mint', 'lilac', 'peach', 'violet'][index % 5], progress: 0 }} index={index} onClick={() => router.push(`/admin/courses/${course.id}/preview`)} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 4px 0' }}><span className={`badge ${course.published ? 'badge-active' : 'badge-inactive'}`}>{course.published ? 'Published' : 'Draft'}</span><button className="text-button" onClick={() => router.push(`/admin/courses/${course.id}`)}>Edit course</button></div>
      </div>)}</div> : <div className="panel" style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', marginBottom: 24 }}>No courses created yet. Create your first course to populate the overview.</div>}
      <div className="overview-lower-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
        <div className="panel"><div className="panel-head"><div><p className="eyebrow">Action queue</p><h3>Needs attention</h3></div><AlertTriangle size={20} color="var(--orange)" /></div><p className="muted">{data.activeInvitations} pending invitation{data.activeInvitations === 1 ? '' : 's'} across the platform.</p><p className="muted">{data.incompleteCourses?.length ?? 0} recent course{data.incompleteCourses?.length === 1 ? '' : 's'} need modules and lessons.</p><button className="text-button" onClick={() => router.push('/admin/courses')}>Review content</button></div>
        <div className="panel"><div className="panel-head"><div><p className="eyebrow">Learning activity</p><h3>Platform usage</h3></div><BarChart3 size={20} /></div><p className="muted">{data.totalCompletions} course completions and {Math.round(data.totalLearningMinutes / 60)} hours watched across all schools.</p><button className="text-button" onClick={() => router.push('/admin/analytics')}>Open analytics</button></div>
      </div>
    </div>
  </AdminShell>
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

      {courses.length > 0 ? <div className="course-grid">{courses.map((course, index) => <div key={course.id}>
        <CourseCard course={{ id: course.id, title: course.title, description: course.description, label: course.section?.name ?? 'Course', duration: `${course.durationMinutes} min`, lessons: `${course.moduleCount ?? 0} modules`, tone: ['blue', 'mint', 'lilac', 'peach', 'violet'][index % 5], progress: 0 }} index={index} onClick={() => router.push(`/admin/courses/${course.id}`)} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 4px 0' }}><span className={`badge ${course.published ? 'badge-active' : 'badge-inactive'}`}>{course.published ? 'Published by Atlas' : 'Draft'}</span><button className="text-button" onClick={() => router.push(`/admin/courses/${course.id}`)}>Edit course</button></div>
      </div>)}</div> : <div className="panel" style={{ padding: 36, textAlign: 'center' }}><BookOpen size={28} color="var(--blue)" style={{ marginBottom: 10 }} /><h3>No courses yet</h3><p className="muted">Courses you create will appear here. Start with a title, description and learning structure.</p><button className="primary-button" onClick={() => router.push('/admin/courses')}><Plus size={16} /> Create your first course</button></div>}
    </div>
  </AdminShell>
}
