'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, HeartHandshake, Play } from 'lucide-react'
import AuthShell from '@/components/AuthShell'
import CourseCard from '@/components/CourseCard'
import { useToast } from '@/components/Toast'
import { formatClock } from '@/lib/format'

type Parent = { id: string; name: string; email: string; status: string; lastActiveAt: string | null; createdAt: string }
type ParentCourse = { id: string; title: string; description: string; coverImageUrl: string | null; durationMinutes: number; durationSeconds: number; label: string; moduleCount: number; lessonCount: number }
type Data = { schoolName: string; link: { token: string | null; enabled: boolean }; parents: Parent[]; courses: ParentCourse[] }

function formatWhen(dateStr: string | null) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const now = new Date()
  const diffDay = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDay <= 0) return 'Today'
  if (diffDay === 1) return 'Yesterday'
  if (diffDay < 7) return `${diffDay} days ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function SchoolParentsPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [origin, setOrigin] = useState('')

  useEffect(() => {
    setOrigin(window.location.origin)
    fetch('/api/school/parents')
      .then((res) => res.json())
      .then((result) => { setData(result ?? null); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const shareUrl = data?.link.token ? `${origin}/register?school=${data.link.token}` : ''

  async function copyLink() {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast('Link copied', 'success')
    } catch {
      toast('Unable to copy link', 'error')
    }
  }

  if (loading) return <AuthShell active="Parents"><div className="page-wrap"><p>Loading parents...</p></div></AuthShell>

  return <AuthShell active="Parents">
    <div className="page-wrap">
      <div className="page-heading compact">
        <div>
          <p className="eyebrow">Your school</p>
          <h1>Parents</h1>
          <p className="muted">Share the registration link with parents and see who has joined {data?.schoolName ?? 'your school'}.</p>
        </div>
      </div>

      <section className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-head"><div><p className="eyebrow">Registration link</p><h2 style={{ margin: 0 }}>Parent sign-up link</h2></div></div>
        {!data?.link.token
          ? <p className="muted">No registration link has been generated for your school yet. Ask Atlas Support to create one.</p>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input readOnly value={shareUrl} aria-label="Parent registration link" style={{ flex: 1, minWidth: 260, height: 40, borderRadius: 8, border: '1px solid var(--line)', padding: '0 12px', fontSize: 13, background: '#fff' }} />
              <button className="secondary-button" onClick={copyLink}><Copy size={16} /> Copy</button>
            </div>
            <span className={`badge ${data.link.enabled ? 'badge-parent' : 'badge-inactive'}`} style={{ width: 'fit-content' }}>{data.link.enabled ? 'Enabled' : 'Disabled'}</span>
          </div>}
      </section>

      <section className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-head"><div><p className="eyebrow">Registered parents</p></div></div>
        {!data || data.parents.length === 0
          ? <p className="muted">No parents have registered yet.</p>
          : <div className="table-wrap"><table className="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Joined</th><th>Last active</th></tr></thead><tbody>{data.parents.map((parent) => <tr key={parent.id}><td><strong>{parent.name}</strong></td><td>{parent.email}</td><td><span className={`badge ${parent.status === 'ACTIVE' ? 'badge-parent' : 'badge-inactive'}`}>{parent.status}</span></td><td>{new Date(parent.createdAt).toLocaleDateString('en-GB')}</td><td>{formatWhen(parent.lastActiveAt)}</td></tr>)}</tbody></table></div>}
      </section>

      <section className="panel">
        <div className="panel-head"><div><h2>Courses available to your parents</h2><p className="muted">Select a course to preview it. Previews are read-only and are never recorded in your analytics.</p></div></div>
        {!data || data.courses.length === 0
          ? <div className="content-empty"><div><HeartHandshake size={22} /></div><h3>No parent courses yet</h3><p>No parent courses are available to your school yet. Atlas will let you know when courses are shared.</p></div>
          : <><div className="course-grid">{data.courses.map((course, index) => <CourseCard key={course.id} index={index} showProgress={false} onClick={() => router.push(`/school/parents/courses/${course.id}`)} course={{ id: course.id, title: course.title, description: course.description, label: course.label, coverImageUrl: course.coverImageUrl, duration: formatClock(course.durationSeconds), lessons: `${course.lessonCount} ${course.lessonCount === 1 ? 'lesson' : 'lessons'}`, tone: ['blue', 'mint', 'lilac', 'peach', 'violet'][index % 5] }} />)}</div><p className="muted" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 16, fontSize: 12 }}><Play size={13} /> Select a course to open a read-only preview.</p></>}
      </section>
    </div>
  </AuthShell>
}
