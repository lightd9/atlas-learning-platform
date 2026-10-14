'use client'

import { use, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Copy, Link2, RefreshCw } from 'lucide-react'
import AdminShell from '@/components/AdminShell'
import { useToast } from '@/components/Toast'

type Parent = { id: string; name: string; email: string; status: string; lastActiveAt: string | null; createdAt: string }
type ParentCourse = { id: string; title: string; published: boolean; enabled: boolean }
type Data = { link: { token: string | null; enabled: boolean; createdAt: string | null }; parents: Parent[]; courses: ParentCourse[] }

export default function AdminSchoolParentsPage({ params }: { params: Promise<{ schoolId: string }> }) {
  const { schoolId } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [schoolName, setSchoolName] = useState('')
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [linkBusy, setLinkBusy] = useState(false)
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([])
  const [savedCourseIds, setSavedCourseIds] = useState<string[]>([])
  const [courseSaving, setCourseSaving] = useState(false)
  const [origin, setOrigin] = useState('')

  async function load() {
    const [parentsRes, schoolRes] = await Promise.all([
      fetch(`/api/admin/schools/${schoolId}/parents`),
      fetch(`/api/admin/schools/${schoolId}`),
    ])
    const parentsData = await parentsRes.json()
    const schoolData = await schoolRes.json()
    setData(parentsData ?? null)
    setSchoolName(schoolData.school?.name ?? '')
    const enabledIds = (parentsData.courses ?? []).filter((course: ParentCourse) => course.enabled).map((course: ParentCourse) => course.id)
    setSelectedCourseIds(enabledIds)
    setSavedCourseIds(enabledIds)
    setLoading(false)
  }

  useEffect(() => { setOrigin(window.location.origin) }, [])

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated' && session?.user?.role !== 'ATLAS_ADMIN' && !(session?.user?.role === 'ATLAS_EMPLOYEE' && Array.isArray(session.user.permissions) && (session.user.permissions as string[]).includes('SCHOOL_CREATE'))) { router.push('/dashboard'); return }
    if (status === 'authenticated') load().catch(() => setLoading(false))
  }, [status, session, router, schoolId])

  const shareUrl = data?.link.token ? `${origin}/register?school=${data.link.token}` : ''

  async function generateLink(regenerate: boolean) {
    setLinkBusy(true)
    const res = await fetch(`/api/admin/schools/${schoolId}/parents`, { method: 'POST' })
    const result = await res.json().catch(() => ({}))
    setLinkBusy(false)
    if (!res.ok) { toast(result.error ?? 'Unable to generate link', 'error'); return }
    toast(regenerate ? 'Registration link regenerated' : 'Registration link generated', 'success')
    load()
  }

  async function toggleEnabled() {
    if (!data) return
    setLinkBusy(true)
    const res = await fetch(`/api/admin/schools/${schoolId}/parents`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !data.link.enabled }) })
    const result = await res.json().catch(() => ({}))
    setLinkBusy(false)
    if (!res.ok) { toast(result.error ?? 'Unable to update link', 'error'); return }
    toast(data.link.enabled ? 'Registration link disabled' : 'Registration link enabled', 'success')
    load()
  }

  async function copyLink() {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast('Link copied', 'success')
    } catch {
      toast('Unable to copy link', 'error')
    }
  }

  async function saveCourseSelection() {
    setCourseSaving(true)
    const res = await fetch('/api/admin/school-access', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ schoolId, courseIds: selectedCourseIds, audience: 'PARENT' }) })
    const result = await res.json().catch(() => ({}))
    setCourseSaving(false)
    if (!res.ok) { toast(result.error ?? 'Unable to save parent courses', 'error'); return }
    setSavedCourseIds([...selectedCourseIds])
    toast('Parent course access saved', 'success')
  }

  function discardCourseSelection() {
    setSelectedCourseIds([...savedCourseIds])
    toast('Changes discarded', 'info')
  }

  if (loading) return <AdminShell active="schools"><div className="page-wrap"><p>Loading parents...</p></div></AdminShell>

  const courseSelectionDirty = selectedCourseIds.length !== savedCourseIds.length || selectedCourseIds.some((id) => !savedCourseIds.includes(id))

  return <AdminShell active="schools">
    <div className="page-wrap">
      <button className="text-button" onClick={() => router.push(`/admin/schools/${schoolId}`)} style={{ marginBottom: 16, display: 'inline-flex', alignItems: 'center', gap: 6 }}><ArrowLeft size={16} /> Back to school</button>
      <div className="page-heading compact">
        <div><p className="eyebrow">School management</p><h1>Parents</h1><p className="muted">{schoolName}</p></div>
      </div>

      <section className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-head"><div><h2 style={{ margin: 0 }}>Parent sign-up link</h2><p className="muted">Share this unique link with {schoolName || 'the school'}. Parents who use it are added to this school only.</p></div></div>
        {!data?.link.token ? (
          <button className="primary-button" onClick={() => generateLink(false)} disabled={linkBusy}><Link2 size={16} /> {linkBusy ? 'Generating...' : 'Generate registration link'}</button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input readOnly value={shareUrl} aria-label="Parent registration link" style={{ flex: 1, minWidth: 260, height: 40, borderRadius: 8, border: '1px solid var(--line)', padding: '0 12px', fontSize: 13, background: '#fff' }} />
              <button className="secondary-button" onClick={copyLink}><Copy size={16} /> Copy</button>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className={`badge ${data.link.enabled ? 'badge-parent' : 'badge-inactive'}`}>{data.link.enabled ? 'Enabled' : 'Disabled'}</span>
              <button className="secondary-button" onClick={() => generateLink(true)} disabled={linkBusy}><RefreshCw size={16} /> Regenerate</button>
              <button className="secondary-button" onClick={toggleEnabled} disabled={linkBusy}>{data.link.enabled ? 'Disable link' : 'Enable link'}</button>
            </div>
          </div>
        )}
      </section>

      <section className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-head"><div><p className="eyebrow">Registered parents</p></div></div>
        {!data || data.parents.length === 0
          ? <p className="muted">No parents have registered yet.</p>
                      : <div className="table-wrap"><table className="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Joined</th><th>Last active</th></tr></thead><tbody>{data.parents.map((parent) => <tr key={parent.id}><td><strong>{parent.name}</strong></td><td>{parent.email}</td><td><span className={`badge ${parent.status === 'ACTIVE' ? 'badge-parent' : 'badge-inactive'}`}>{parent.status}</span></td><td>{new Date(parent.createdAt).toLocaleDateString('en-GB')}</td><td>{parent.lastActiveAt ? new Date(parent.lastActiveAt).toLocaleDateString('en-GB') : '—'}</td></tr>)}</tbody></table></div>}
      </section>

      <section className="panel">
        <div className="panel-head"><div><h2>Courses available to {schoolName || 'this school'}&apos;s parents</h2><p className="muted">Only parent-audience courses are listed. Select which ones this school&apos;s parents can access.</p></div></div>
        {!data || data.courses.length === 0
          ? <p className="muted">No parent courses have been created yet.</p>
          : <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
              <button className="secondary-button" style={{ height: 34, fontSize: 12 }} onClick={() => setSelectedCourseIds(data.courses.map((course) => course.id))}>Select all</button>
              <button className="secondary-button" style={{ height: 34, fontSize: 12 }} onClick={() => setSelectedCourseIds([])}>Deselect all</button>
              <span className="muted" style={{ marginLeft: 'auto', fontSize: 12 }}>{selectedCourseIds.length}/{data.courses.length} selected</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{data.courses.map((course) => <label key={course.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', padding: '12px 0' }}><span><strong>{course.title}</strong><small style={{ display: 'block', color: 'var(--muted)' }}>{course.published ? 'Published' : 'Draft'}</small></span><input type="checkbox" checked={selectedCourseIds.includes(course.id)} onChange={(e) => setSelectedCourseIds(e.target.checked ? [...selectedCourseIds, course.id] : selectedCourseIds.filter((id) => id !== course.id))} aria-label={`Assign ${course.title} to ${schoolName}'s parents`} /></label>)}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, flexWrap: 'wrap' }}><button className="primary-button" onClick={saveCourseSelection} disabled={courseSaving || !courseSelectionDirty}>{courseSaving ? 'Saving...' : 'Save changes'}</button><button className="secondary-button" onClick={discardCourseSelection} disabled={courseSaving || !courseSelectionDirty}>Discard changes</button></div>
          </>}
      </section>
    </div>
  </AdminShell>
}
