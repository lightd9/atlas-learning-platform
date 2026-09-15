'use client'

import { use, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Ban, Building2, CheckSquare, FileUp, Mail, Pencil, Plus, RefreshCw, Save, Trash2, Users, X } from 'lucide-react'
import AdminShell from '@/components/AdminShell'
import { useToast } from '@/components/Toast'

type SchoolData = {
  id: string; name: string; slug: string; active: boolean; userCount: number; courseCount: number
  users: { id: string; name: string; email: string; role: string; status: string; lastActiveAt: string | null }[]
  invitations: { id: string; name: string; email: string; status: string; expiresAt: string }[]
  courseAccess: { schoolId: string; courseId: string; enabled: boolean; course: { id: string; title: string; published: boolean } }[]
}

type Course = { id: string; title: string; published: boolean }
type HeadteacherOption = { id: string; name: string; email: string; role: string; status: string }

export default function AdminSchoolDetailPage({ params }: { params: Promise<{ schoolId: string }> }) {
  const { schoolId } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [school, setSchool] = useState<SchoolData | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [form, setForm] = useState({ name: '', email: '' })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([])
  const [savedCourseIds, setSavedCourseIds] = useState<string[]>([])
  const [courseSaving, setCourseSaving] = useState(false)
  const [headteachers, setHeadteachers] = useState<HeadteacherOption[]>([])
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileForm, setProfileForm] = useState({ name: '', slug: '', headteacherId: '' })
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [selectedInvitationIds, setSelectedInvitationIds] = useState<string[]>([])
  const [deleting, setDeleting] = useState(false)
  const [teamSelectMode, setTeamSelectMode] = useState(false)
  const [inviteSelectMode, setInviteSelectMode] = useState(false)

  async function load() {
    const [schoolRes, courseRes] = await Promise.all([fetch(`/api/admin/schools/${schoolId}`), fetch('/api/admin/courses')])
    const schoolData = await schoolRes.json()
    const courseData = await courseRes.json()
    setSchool(schoolData.school ?? null)
    setHeadteachers((schoolData.school?.users ?? []).filter((user: HeadteacherOption) => ['TEACHER', 'HEADTEACHER'].includes(user.role) && user.status !== 'DISABLED'))
    const currentHeadteacher = (schoolData.school?.users ?? []).find((user: SchoolData['users'][number]) => user.role === 'HEADTEACHER')
    setProfileForm({ name: schoolData.school?.name ?? '', slug: schoolData.school?.slug ?? '', headteacherId: currentHeadteacher?.id ?? '' })
    const availableCourses: Course[] = (courseData.courses ?? []).map((course: Course) => ({ id: course.id, title: course.title, published: course.published }))
    setCourses(availableCourses)
    const accessByCourse = new Map((schoolData.school?.courseAccess ?? []).map((access: SchoolData['courseAccess'][number]) => [access.courseId, access.enabled]))
    const savedIds = availableCourses.filter((course) => accessByCourse.get(course.id) ?? true).map((course) => course.id)
    setSelectedCourseIds(savedIds)
    setSavedCourseIds(savedIds)
    setLoading(false)
  }

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated' && session?.user?.role !== 'ATLAS_ADMIN') { router.push('/dashboard'); return }
    if (status === 'authenticated') load().catch(() => setLoading(false))
  }, [status, session, router, schoolId])

  async function inviteTeacher(e: React.FormEvent) {
    e.preventDefault(); setError(''); setMessage('')
    const res = await fetch('/api/invitations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ schoolId, invitations: [form] }) })
    const data = await res.json()
    if (!res.ok) { const message = data.error ?? 'Unable to send invitation'; setError(message); toast(message, 'error'); return }
    setForm({ name: '', email: '' }); setShowInvite(false); setMessage('Invitation sent.'); toast('Invitation sent', 'success'); load()
  }

  async function resend(id: string) { const response = await fetch(`/api/invitations/${id}`, { method: 'POST' }); setMessage(response.ok ? 'Invitation resent.' : 'Unable to resend invitation.'); toast(response.ok ? 'Invitation resent' : 'Unable to resend invitation', response.ok ? 'success' : 'error'); load() }
  async function revoke(id: string) { const response = await fetch(`/api/invitations/${id}`, { method: 'DELETE' }); setMessage(response.ok ? 'Invitation revoked.' : 'Unable to revoke invitation.'); toast(response.ok ? 'Invitation revoked' : 'Unable to revoke invitation', response.ok ? 'success' : 'error'); load() }

  async function deleteMembers(userIds: string[], invitationIds: string[]) {
    if (userIds.length === 0 && invitationIds.length === 0) return
    const count = userIds.length + invitationIds.length
    if (!window.confirm(`Delete ${count} selected ${count === 1 ? 'member' : 'members'}? Active accounts, their course progress and sent invitations are permanently removed.`)) return
    setDeleting(true)
    const res = await fetch('/api/admin/users/bulk-delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userIds, invitationIds }) })
    setDeleting(false)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { toast(data.error ?? 'Unable to delete', 'error'); return }
    setSelectedUserIds([]); setSelectedInvitationIds([])
    toast('Deleted', 'success')
    load()
  }

  function toggleTeamSelect() { setSelectedUserIds([]); setTeamSelectMode((v) => !v) }
  function exitTeamSelect() { setSelectedUserIds([]); setTeamSelectMode(false) }
  function toggleInviteSelect() { setSelectedInvitationIds([]); setInviteSelectMode((v) => !v) }
  function exitInviteSelect() { setSelectedInvitationIds([]); setInviteSelectMode(false) }

  async function saveCourseSelection() {
    setCourseSaving(true); setMessage('')
    const response = await fetch('/api/admin/school-access', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ schoolId, courseIds: selectedCourseIds }) })
    const data = await response.json()
    setCourseSaving(false)
    if (!response.ok) { const message = data.error ?? 'Unable to save course access.'; setMessage(message); toast(message, 'error'); return }
    setSavedCourseIds([...selectedCourseIds])
    setMessage('Course access saved.')
    toast('Course access saved', 'success')
  }

  function discardCourseSelection() {
    setSelectedCourseIds([...savedCourseIds])
    setMessage('Unsaved course changes discarded.')
    toast('Changes discarded', 'info')
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault(); setProfileSaving(true); setError(''); setMessage('')
    const response = await fetch(`/api/admin/schools/${schoolId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: profileForm.name, slug: profileForm.slug, headteacherId: profileForm.headteacherId || null }) })
    const data = await response.json()
    setProfileSaving(false)
    if (!response.ok) { const message = data.error ?? 'Unable to save school profile.'; setError(message); toast(message, 'error'); return }
    setEditingProfile(false); setMessage('School profile saved.'); toast('Changes saved', 'success'); await load()
  }

  if (loading) return <AdminShell active="schools"><div className="page-wrap"><p>Loading school...</p></div></AdminShell>
  if (!school) return <AdminShell active="schools"><div className="page-wrap"><p>School not found.</p></div></AdminShell>

  const courseSelectionDirty = selectedCourseIds.length !== savedCourseIds.length || selectedCourseIds.some((id) => !savedCourseIds.includes(id))
  return <AdminShell active="schools">
    <div className="page-wrap">
      <button className="text-button" onClick={() => router.push('/admin/schools')} style={{ marginBottom: 16, display: 'inline-flex', alignItems: 'center', gap: 6 }}><ArrowLeft size={16} /> Back to schools</button>
      <div className="page-heading compact">
        <div><p className="eyebrow">School management</p><h1>{school.name}</h1><p className="muted">{school.slug} · <span className={`badge ${school.active ? 'badge-active' : 'badge-inactive'}`}>{school.active ? 'Active' : 'Disabled'}</span></p></div>
        <div className="school-profile-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button className="secondary-button" onClick={() => setEditingProfile(true)}><Pencil size={16} /> Edit profile</button><button className="secondary-button" style={school.active ? { color: '#b42318', borderColor: '#fecdca', background: '#00000' } : undefined} onClick={async () => { const response = await fetch(`/api/admin/schools/${schoolId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !school.active }) }); toast(response.ok ? (school.active ? 'School disabled' : 'School enabled') : 'Unable to update school status', response.ok ? 'success' : 'error'); if (response.ok) load() }}>{school.active ? 'Disable school' : 'Enable school'}</button></div>
      </div>
      {message && <p role="status" style={{ color: 'var(--green)', fontSize: 13 }}>{message}</p>}
      {editingProfile && <form className="panel school-profile-editor" onSubmit={saveProfile} style={{ marginBottom: 24 }}><div className="panel-head"><div><p className="eyebrow">School profile</p><h2>Edit school details</h2><p className="muted">The headteacher created with this school is selected by default. You can transfer the role to another teacher from this school.</p></div><button type="button" className="icon-button" onClick={() => setEditingProfile(false)} aria-label="Close school profile editor"><X size={17} /></button></div><div className="school-profile-fields" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}><label style={labelStyle}>School name<input required value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} style={inputStyle} /></label><label style={labelStyle}>School slug<input required pattern="[a-z0-9-]+" value={profileForm.slug} onChange={(e) => setProfileForm({ ...profileForm, slug: e.target.value.toLowerCase() })} style={inputStyle} /><small className="muted">Lowercase letters, numbers and hyphens.</small></label><label style={labelStyle}>Headteacher<select value={profileForm.headteacherId} onChange={(e) => setProfileForm({ ...profileForm, headteacherId: e.target.value })} style={inputStyle}><option value="">No headteacher assigned</option>{headteachers.map((user) => <option key={user.id} value={user.id}>{user.name}{user.role === 'HEADTEACHER' ? ' (current headteacher)' : ' (teacher)'} — {user.email}</option>)}</select></label></div>{error && <p role="alert" style={{ color: '#b42318', fontSize: 12 }}>{error}</p>}<div style={{ display: 'flex', gap: 8, marginTop: 16 }}><button className="primary-button" type="submit" disabled={profileSaving}><Save size={16} /> {profileSaving ? 'Saving...' : 'Save profile'}</button><button className="secondary-button" type="button" onClick={() => setEditingProfile(false)}>Cancel</button></div></form>}

      <div className="metric-grid school-profile-metrics" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
        <div className="metric-card"><Building2 size={18} /><span>School status</span><strong>{school.active ? 'Active' : 'Disabled'}</strong></div>
        <div className="metric-card"><Users size={18} /><span>Team members</span><strong>{school.userCount}</strong></div>
        <div className="metric-card"><Mail size={18} /><span>Assigned courses</span><strong>{school.courseCount}</strong></div>
      </div>

      <section className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-head"><div><p className="eyebrow">School team</p><h2>Teachers and headteacher</h2></div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button className="secondary-button" style={teamSelectMode ? { borderColor: 'var(--blue)', color: 'var(--blue)' } : undefined} onClick={toggleTeamSelect}><CheckSquare size={16} /> {teamSelectMode ? 'Selecting…' : 'Select'}</button><button className="secondary-button" onClick={() => router.push(`/school/teachers/import?schoolId=${schoolId}`)}><FileUp size={16} /> Bulk upload CSV</button><button className="primary-button" onClick={() => setShowInvite(!showInvite)}><Plus size={16} /> Add teacher</button></div></div>
        {showInvite && <form onSubmit={inviteTeacher} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}><input aria-label="Teacher name" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required style={inputStyle} /><input aria-label="Teacher email" type="email" placeholder="Email address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required style={inputStyle} /><button className="primary-button" type="submit">Send invite</button>{error && <span role="alert" style={{ color: '#b42318', fontSize: 12 }}>{error}</span>}</form>}
        <div className="table-wrap"><table className="admin-table"><thead><tr>{teamSelectMode && <th style={{ width: 36 }}><input type="checkbox" checked={selectedUserIds.length === school.users.filter((u) => u.id !== session?.user?.id).length && school.users.length > 0} onChange={(e) => setSelectedUserIds(e.target.checked ? school.users.filter((u) => u.id !== session?.user?.id).map((u) => u.id) : [])} aria-label="Select all team members" /></th>}<th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last active</th><th /></tr></thead><tbody>{school.users.map((user) => <tr key={user.id}>{teamSelectMode && <td>{user.id === session?.user?.id ? null : <input type="checkbox" checked={selectedUserIds.includes(user.id)} onChange={(e) => setSelectedUserIds(e.target.checked ? [...selectedUserIds, user.id] : selectedUserIds.filter((id) => id !== user.id))} aria-label={`Select ${user.name}`} />}</td>}<td><strong>{user.name}</strong></td><td>{user.email}</td><td>{user.role === 'HEADTEACHER' ? 'Headteacher' : user.role === 'INSTRUCTOR' ? 'Instructor' : user.role === 'ATLAS_ADMIN' ? 'Atlas Admin' : 'Teacher'}</td><td><span className={`badge ${user.status === 'ACTIVE' ? 'badge-active' : 'badge-inactive'}`}>{user.status}</span></td><td>{user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleDateString('en-GB') : '—'}</td><td>{user.id === session?.user?.id ? <span className="muted" style={{ fontSize: 12 }}>You</span> : <button className="text-button" onClick={() => deleteMembers([user.id], [])} style={{ ...iconButtonStyle, color: '#b42318' }} title={`Delete ${user.name}`}><Trash2 size={14} /></button>}</td></tr>)}</tbody></table></div>
        {teamSelectMode && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}><button className="secondary-button" style={{ color: '#b42318', borderColor: '#fecdca' }} onClick={() => deleteMembers(selectedUserIds, [])} disabled={deleting || selectedUserIds.length === 0}><Trash2 size={14} /> Delete selected ({selectedUserIds.length})</button><button className="secondary-button" onClick={exitTeamSelect}>Done</button></div>}
        {school.invitations.length > 0 && <div style={{ marginTop: 32 }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}><h3 style={{ margin: 0 }}>Pending invitations</h3><button className="secondary-button" style={inviteSelectMode ? { borderColor: 'var(--blue)', color: 'var(--blue)', height: 32, fontSize: 12 } : { height: 32, fontSize: 12 }} onClick={toggleInviteSelect}><CheckSquare size={15} /> {inviteSelectMode ? 'Selecting…' : 'Select'}</button></div><div className="table-wrap"><table className="admin-table"><thead><tr>{inviteSelectMode && <th style={{ width: 36 }}><input type="checkbox" checked={selectedInvitationIds.length === school.invitations.length} onChange={(e) => setSelectedInvitationIds(e.target.checked ? school.invitations.map((inv) => inv.id) : [])} aria-label="Select all invitations" /></th>}<th>Name</th><th>Email</th><th>Status</th><th>Actions</th><th /></tr></thead><tbody>{school.invitations.map((invite) => <tr key={invite.id}>{inviteSelectMode && <td><input type="checkbox" checked={selectedInvitationIds.includes(invite.id)} onChange={(e) => setSelectedInvitationIds(e.target.checked ? [...selectedInvitationIds, invite.id] : selectedInvitationIds.filter((id) => id !== invite.id))} aria-label={`Select invitation for ${invite.name}`} /></td>}<td>{invite.name}</td><td>{invite.email}</td><td><span className="badge badge-pending">{invite.status}</span></td><td><button className="text-button" onClick={() => resend(invite.id)}><RefreshCw size={14} /> Resend</button><button className="text-button" onClick={() => revoke(invite.id)} style={{ color: '#b42318', marginLeft: 8 }}><Ban size={14} /> Revoke</button></td><td><button className="text-button" onClick={() => deleteMembers([], [invite.id])} style={{ ...iconButtonStyle, color: '#b42318' }} title={`Delete invitation for ${invite.name}`}><Trash2 size={14} /></button></td></tr>)}</tbody></table></div>{inviteSelectMode && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}><button className="secondary-button" style={{ color: '#b42318', borderColor: '#fecdca', height: 34, fontSize: 12 }} onClick={() => deleteMembers([], selectedInvitationIds)} disabled={deleting || selectedInvitationIds.length === 0}><Trash2 size={14} /> Delete selected ({selectedInvitationIds.length})</button><button className="secondary-button" style={{ height: 34, fontSize: 12 }} onClick={exitInviteSelect}>Done</button></div>}</div>}
      </section>

      <section className="panel"><div className="panel-head"><div><p className="eyebrow">Course access</p><h2>Courses available to this school</h2><p className="muted">Courses are available globally by default. Select the courses this school should access, then save your changes.</p></div></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
          <button className="secondary-button" style={{ height: 34, fontSize: 12 }} onClick={() => setSelectedCourseIds(courses.map((course) => course.id))}>Select all</button>
          <button className="secondary-button" style={{ height: 34, fontSize: 12 }} onClick={() => setSelectedCourseIds([])}>Deselect all</button>
          <span className="muted" style={{ marginLeft: 'auto', fontSize: 12 }}>{selectedCourseIds.length}/{courses.length} selected</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{courses.map((course) => <label key={course.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', padding: '12px 0' }}><span><strong>{course.title}</strong><small style={{ display: 'block', color: 'var(--muted)' }}>{course.published ? 'Published' : 'Draft'}</small></span><input type="checkbox" checked={selectedCourseIds.includes(course.id)} onChange={(e) => setSelectedCourseIds(e.target.checked ? [...selectedCourseIds, course.id] : selectedCourseIds.filter((id) => id !== course.id))} aria-label={`Assign ${course.title} to ${school.name}`} /></label>)}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, flexWrap: 'wrap' }}><button className="primary-button" onClick={saveCourseSelection} disabled={courseSaving || !courseSelectionDirty}>{courseSaving ? 'Saving...' : 'Save changes'}</button><button className="secondary-button" onClick={discardCourseSelection} disabled={courseSaving || !courseSelectionDirty}>Discard changes</button></div>
      </section>
    </div>
  </AdminShell>
}

const inputStyle: React.CSSProperties = { height: 40, borderRadius: 8, border: '1px solid var(--line)', padding: '0 12px', fontSize: 13, background: '#00000', minWidth: 220 }
const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600 }
const iconButtonStyle: React.CSSProperties = { width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', verticalAlign: 'middle', borderRadius: 6 }
