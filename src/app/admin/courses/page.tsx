'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { BookOpen, Plus, Search, Trash2, GripVertical, Eye, Pencil, Globe, EyeOff } from 'lucide-react'
import AdminShell from '@/components/AdminShell'
import AppModal from '@/components/AppModal'
import { useToast } from '@/components/Toast'
import DurationInput from '@/components/DurationInput'
import { courseTotalSeconds, formatClock } from '@/lib/format'
import type { AdminCourse } from '@/types/api'

export default function AdminCoursesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const isAtlasAdmin = session?.user?.role === 'ATLAS_ADMIN'
  const employeePermissions = Array.isArray(session?.user?.permissions) ? session.user.permissions as string[] : []
  const canAssignSchools = isAtlasAdmin || (session?.user?.role === 'ATLAS_EMPLOYEE' && employeePermissions.includes('SCHOOL_ASSIGN'))
  const canDeleteCourses = isAtlasAdmin || (session?.user?.role === 'ATLAS_EMPLOYEE' && employeePermissions.includes('COURSE_DELETE'))
  const [courses, setCourses] = useState<AdminCourse[]>([])
  const [schools, setSchools] = useState<{ id: string; name: string; active?: boolean }[]>([])
  const [availabilityMode, setAvailabilityMode] = useState<'ALL' | 'SELECTED'>('ALL')
  const [selectedSchoolIds, setSelectedSchoolIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ slug: '', title: '', description: '', coverImageUrl: '', durationSeconds: 1200, muxPlaybackId: '', notes: '' })
  const [resources, setResources] = useState<{ title: string; description: string; url: string; fileName: string; sortOrder: number }[]>([])
  const [modules, setModules] = useState<{ title: string; description: string; sortOrder: number; lessons: { title: string; description: string; durationSeconds: number; muxPlaybackId: string; sortOrder: number }[] }[]>([])
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated' && session?.user?.role !== 'ATLAS_ADMIN' && session?.user?.role !== 'ATLAS_EMPLOYEE' && session?.user?.role !== 'INSTRUCTOR') { router.push('/dashboard'); return }
    if (status === 'authenticated') {
      Promise.all([fetch('/api/admin/courses').then((r) => r.json()), canAssignSchools ? fetch('/api/admin/schools').then((r) => r.json()) : Promise.resolve({ schools: [] })]).then(([courseData, schoolData]) => { const activeSchools = (schoolData.schools ?? []).filter((school: { active?: boolean }) => school.active !== false); setCourses(courseData.courses ?? []); setSchools(activeSchools); setSelectedSchoolIds(activeSchools.map((school: { id: string }) => school.id)); setLoading(false) }).catch(() => setLoading(false))
    }
  }, [status, session, router, isAtlasAdmin, canAssignSchools])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const res = await fetch('/api/admin/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, durationMinutes: Math.max(1, Math.ceil(form.durationSeconds / 60)), modules, resources }),
    })
    const data = await res.json()
    if (!res.ok) {
      let message = data.error ?? 'Unable to create course'
      if (data.details?.fieldErrors) {
        const parts: string[] = []
        for (const [field, errors] of Object.entries(data.details.fieldErrors as Record<string, string[]>) as [string, string[]][]) {
          if (errors.length > 0) parts.push(`${field}: ${errors[0]}`)
        }
        if (parts.length > 0) message += ` — ${parts.join('; ')}`
      }
      if (data.suggestion) message += ` ${data.suggestion}`
      setError(message)
      toast(message, 'error')
      return
    }
    if (canAssignSchools && availabilityMode === 'SELECTED') {
      const accessResponse = await fetch('/api/admin/school-access', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courseId: data.course.id, schoolIds: selectedSchoolIds }) })
      if (!accessResponse.ok) toast('Course created, but school availability could not be saved. Open Edit to try again.', 'error')
    }
    setCourses([data.course, ...courses])
    setShowCreate(false)
    setForm({ slug: '', title: '', description: '', coverImageUrl: '', durationSeconds: 1200, muxPlaybackId: '', notes: '' })
    setModules([])
    setResources([])
    setAvailabilityMode('ALL'); setSelectedSchoolIds(schools.map((school) => school.id))
    toast('Course created', 'success')
  }

  async function togglePublish(course: AdminCourse) {
    const res = await fetch(`/api/admin/courses/${course.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ published: !course.published }),
    })
    if (res.ok) {
      setCourses(courses.map((c) => c.id === course.id ? { ...c, published: !c.published } : c))
      toast(course.published ? 'Course unpublished' : 'Course published', 'success')
    } else toast('Unable to update course publication', 'error')
  }

  async function handleDeleteCourse(course: AdminCourse) {
    const confirmed = window.confirm(`Permanently delete "${course.title}"? This removes the course, lessons, resources, and all learner progress. Use Unpublish if you want to retain the course data.`)
    if (!confirmed) return
    const res = await fetch(`/api/admin/courses/${course.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) { toast(data.error ?? 'Unable to delete course', 'error'); return }
    setCourses(courses.filter((c) => c.id !== course.id))
    toast(data.message ?? 'Course deleted', 'success')
  }

  function handleCourseAction(course: AdminCourse, action: string) {
    if (action === 'preview') router.push(`/admin/courses/${course.id}/preview`)
    if (action === 'edit') router.push(`/admin/courses/${course.id}`)
    if (action === 'toggle-publish') togglePublish(course)
    if (action === 'delete') handleDeleteCourse(course)
  }

  const filtered = courses.filter((c) => {
    const matchesSearch = c.title.toLowerCase().includes(search.toLowerCase()) || c.slug.toLowerCase().includes(search.toLowerCase()) || Boolean(c.section?.name.toLowerCase().includes(search.toLowerCase()))
    const matchesStatus = !statusFilter || c.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const createDirty =
    form.slug !== '' ||
    form.title !== '' ||
    form.description !== '' ||
    form.coverImageUrl !== '' ||
    form.muxPlaybackId !== '' ||
    form.notes !== '' ||
    form.durationSeconds !== 1200 ||
    resources.length > 0 ||
    modules.length > 0 ||
    availabilityMode === 'SELECTED'

  function resetCreateForm() {
    setForm({ slug: '', title: '', description: '', coverImageUrl: '', durationSeconds: 1200, muxPlaybackId: '', notes: '' })
    setResources([])
    setModules([])
    setAvailabilityMode('ALL')
    setSelectedSchoolIds(schools.map((school) => school.id))
    setError('')
  }

  return <AdminShell active="courses">
    <div className="page-wrap">
      <div className="page-heading">
        <div><p className="eyebrow">Course management</p><h1>Courses</h1><p className="muted">Build, preview and organize Atlas learning content.</p></div>
        <button className="primary-button" onClick={() => { setError(''); setShowCreate(true) }}><Plus size={17} /> Add course</button>
      </div>

      {showCreate && (
        <AppModal
          title="Create new course"
          eyebrow="Course management"
          description="Add the basics, optional resources, and the first modules and lessons."
          icon={<BookOpen size={18} />}
          width={760}
          dirty={createDirty}
          onClose={() => { setShowCreate(false); resetCreateForm() }}
          footer={
            <>
              <button className="secondary-button" onClick={() => { setShowCreate(false); resetCreateForm() }}>Cancel</button>
              <button className="primary-button" type="submit" form="create-course-form">Create course</button>
            </>
          }
        >
          <form id="create-course-form" onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <fieldset style={fieldSetStyle}><legend style={legendStyle}>Course basics</legend>
            <label style={labelStyle}>Course title <span aria-hidden="true">*</span><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required style={inputStyle} /></label>
            <label style={labelStyle}>Course URL slug <span aria-hidden="true">*</span><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') })} required placeholder="e.g. ai-intro" style={inputStyle} /><small style={helperStyle}>Used in the course URL. It cannot be changed later.</small></label>
            <label style={labelStyle}>Course description <span aria-hidden="true">*</span><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required style={{ ...inputStyle, height: 80, paddingTop: 10, resize: 'vertical' }} /></label>
            <label style={labelStyle}>Cover image URL<input type="url" value={form.coverImageUrl} onChange={(e) => setForm({ ...form, coverImageUrl: e.target.value })} placeholder="https://.../course-cover.jpg" style={inputStyle} /><small style={helperStyle}>Optional. Use a stable HTTPS image URL.</small></label>
            <label style={labelStyle}>Course duration<DurationInput totalSeconds={form.durationSeconds} onChange={(durationSeconds) => setForm({ ...form, durationSeconds })} /><small style={helperStyle}>Used for standalone course videos. If lessons are added, lesson durations are used instead.</small></label>
            <label style={labelStyle}>Course Mux playback ID<input value={form.muxPlaybackId} onChange={(e) => setForm({ ...form, muxPlaybackId: e.target.value })} placeholder="Video playback ID" style={inputStyle} /><small style={helperStyle}>Use this when the course is one standalone video without modules or lessons.</small></label>
            </fieldset>
            {session?.user?.role === 'ATLAS_ADMIN' && <fieldset style={fieldSetStyle}><legend style={legendStyle}>School availability</legend><p style={{ ...helperStyle, margin: 0 }}>New courses are available to all active schools by default. Choose selected schools only when this course should be restricted.</p><label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', gap: 8 }}><input type="radio" name="availability" checked={availabilityMode === 'ALL'} onChange={() => { setAvailabilityMode('ALL'); setSelectedSchoolIds(schools.map((school) => school.id)) }} /> All active schools</label><label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', gap: 8 }}><input type="radio" name="availability" checked={availabilityMode === 'SELECTED'} onChange={() => setAvailabilityMode('SELECTED')} /> Selected schools only</label>{availabilityMode === 'SELECTED' && <><div style={{ display: 'flex', gap: 8 }}><button className="text-button" type="button" onClick={() => setSelectedSchoolIds(schools.map((school) => school.id))}>Select all</button><button className="text-button" type="button" onClick={() => setSelectedSchoolIds([])}>Deselect all</button><span style={{ ...helperStyle, marginLeft: 'auto' }}>{selectedSchoolIds.length}/{schools.length} selected</span></div><div style={{ maxHeight: 220, overflowY: 'auto', borderTop: '1px solid var(--line)' }}>{schools.map((school) => <label key={school.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13 }}><span>{school.name}</span><input type="checkbox" checked={selectedSchoolIds.includes(school.id)} onChange={(e) => setSelectedSchoolIds(e.target.checked ? [...selectedSchoolIds, school.id] : selectedSchoolIds.filter((id) => id !== school.id))} aria-label={`Make this course available to ${school.name}`} /></label>)}</div></>}</fieldset>}
            <label style={labelStyle}>Learner notes<textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes learners should read below the video player" style={{ ...inputStyle, height: 90, paddingTop: 10, resize: 'vertical' }} /></label>

            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}><div><h4 style={{ margin: 0, fontSize: 14 }}>Downloadable resources</h4><p style={helperStyle}>Add a direct file URL or trusted external download link.</p></div><button type="button" className="secondary-button" style={{ height: 32, fontSize: 12 }} onClick={() => setResources([...resources, { title: '', description: '', url: '', fileName: '', sortOrder: resources.length }])}><Plus size={14} /> Add resource</button></div>{resources.map((resource, index) => <div className="course-create-resource-row" key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr 1.4fr 1fr 32px', gap: 7, marginBottom: 8 }}><input placeholder="Resource title" value={resource.title} onChange={(e) => { const next = [...resources]; next[index] = { ...next[index], title: e.target.value }; setResources(next) }} style={smallInputStyle} /><input placeholder="Short description" value={resource.description} onChange={(e) => { const next = [...resources]; next[index] = { ...next[index], description: e.target.value }; setResources(next) }} style={smallInputStyle} /><input placeholder="Download URL" type="url" value={resource.url} onChange={(e) => { const next = [...resources]; next[index] = { ...next[index], url: e.target.value }; setResources(next) }} style={smallInputStyle} /><input placeholder="File name (optional)" value={resource.fileName} onChange={(e) => { const next = [...resources]; next[index] = { ...next[index], fileName: e.target.value }; setResources(next) }} style={smallInputStyle} /><button type="button" className="icon-button" aria-label="Remove resource" onClick={() => setResources(resources.filter((_, resourceIndex) => resourceIndex !== index))}><Trash2 size={14} /></button></div>)}</div>

            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 16, marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h4 style={{ margin: 0, fontSize: 14 }}>Modules & lessons</h4>
                <button type="button" className="secondary-button" style={{ fontSize: 12, height: 32, padding: '0 12px' }} onClick={() => setModules([...modules, { title: `Module ${modules.length + 1}`, description: '', sortOrder: modules.length, lessons: [] }])}>
                  <Plus size={14} /> Add module
                </button>
              </div>
              {modules.map((mod, mi) => (
                <div key={mi} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <GripVertical size={16} style={{ color: 'var(--muted)' }} />
                    <input placeholder="Module title" value={mod.title} onChange={(e) => { const m = [...modules]; m[mi] = { ...m[mi], title: e.target.value }; setModules(m) }} style={{ ...inputStyle, flex: 1 }} />
                    <button type="button" className="icon-button" onClick={() => setModules(modules.filter((_, i) => i !== mi))}><Trash2 size={15} style={{ color: '#e53e3e' }} /></button>
                  </div>
                  <div style={{ paddingLeft: 28 }}>
                    <input aria-label={`${mod.title} description`} placeholder="Optional module description" value={mod.description} onChange={(e) => { const m = [...modules]; m[mi] = { ...m[mi], description: e.target.value }; setModules(m) }} style={{ ...inputStyle, marginBottom: 8 }} />
                    {mod.lessons.map((lesson, li) => (
                      <div key={li} style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 130px 1.2fr 32px', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                        <input placeholder="Lesson title" value={lesson.title} onChange={(e) => { const m = [...modules]; m[mi].lessons[li] = { ...m[mi].lessons[li], title: e.target.value }; setModules(m) }} style={{ ...inputStyle, flex: 1, fontSize: 12, height: 34 }} />
                        <input placeholder="Optional lesson description" value={lesson.description} onChange={(e) => { const m = [...modules]; m[mi].lessons[li] = { ...m[mi].lessons[li], description: e.target.value }; setModules(m) }} style={{ ...inputStyle, fontSize: 12, height: 34 }} />
                        <input aria-label="Lesson duration in seconds" placeholder="Duration seconds" type="number" min="0" value={lesson.durationSeconds || ''} onChange={(e) => { const m = [...modules]; m[mi].lessons[li] = { ...m[mi].lessons[li], durationSeconds: Math.max(0, Number(e.target.value)) }; setModules(m) }} style={{ ...inputStyle, fontSize: 12, height: 34 }} />
                        <input aria-label="Lesson Mux playback ID" placeholder="Mux playback ID (optional)" value={lesson.muxPlaybackId} onChange={(e) => { const m = [...modules]; m[mi].lessons[li] = { ...m[mi].lessons[li], muxPlaybackId: e.target.value }; setModules(m) }} style={{ ...inputStyle, fontSize: 12, height: 34 }} />
                        <button type="button" className="icon-button" onClick={() => { const m = [...modules]; m[mi].lessons = m[mi].lessons.filter((_, j) => j !== li); setModules(m) }}><Trash2 size={13} style={{ color: '#e53e3e' }} /></button>
                      </div>
                    ))}
                    <button type="button" className="text-button" style={{ fontSize: 12 }} onClick={() => { const m = [...modules]; m[mi].lessons = [...m[mi].lessons, { title: `Lesson ${m[mi].lessons.length + 1}`, description: '', durationSeconds: 0, muxPlaybackId: '', sortOrder: m[mi].lessons.length }]; setModules(m) }}>
                      <Plus size={13} /> Add lesson
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {error && <p style={{ color: '#e53e3e', margin: 0, fontSize: 13 }}>{error}</p>}
          </form>
        </AppModal>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
      <div className="top-search" style={{ width: '100%', maxWidth: 360 }}>
        <Search size={17} />
        <input placeholder="Search courses..." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search courses" />
      </div>
      <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}><option value="">All statuses</option><option value="PUBLISHED">Published</option><option value="REVIEW">Ready for review</option><option value="DRAFT">Draft</option><option value="ARCHIVED">Archived</option></select>
      </div>

      {loading ? <p>Loading...</p> : filtered.length === 0 ? (
        <div className="panel" style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>No courses found.</div>
      ) : (
        <div className="panel table-wrap" style={{ padding: 0 }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Slug</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Schools</th>
                <th>Enrollments</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((course) => (
                <tr key={course.id}>
                  <td><strong>{course.title}</strong></td>
                  <td style={{ color: 'var(--muted)' }}>{course.slug}</td>
                  <td>{formatClock(courseTotalSeconds(course))}</td>
                  <td><span className={`badge ${course.status === 'PUBLISHED' ? 'badge-active' : course.status === 'REVIEW' ? 'badge-pending' : 'badge-inactive'}`}>{course.status === 'REVIEW' ? 'Ready for review' : course.status ?? (course.published ? 'Published' : 'Draft')}</span></td>
                  <td>{course.schoolAccessCount}</td>
                  <td>{course.progressCount}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="text-button" style={iconButtonStyle} title="Preview course" aria-label={`Preview ${course.title}`} onClick={() => handleCourseAction(course, 'preview')}><Eye size={15} /></button>
                      <button className="text-button" style={iconButtonStyle} title="Edit course" aria-label={`Edit ${course.title}`} onClick={() => handleCourseAction(course, 'edit')}><Pencil size={15} /></button>
                      {session?.user?.role === 'ATLAS_ADMIN' && (
                        <button className="text-button" style={{ ...iconButtonStyle, color: course.published ? 'var(--muted)' : 'var(--blue)' }} title={course.published ? 'Unpublish course' : 'Publish course'} aria-label={`${course.published ? 'Unpublish' : 'Publish'} ${course.title}`} onClick={() => handleCourseAction(course, 'toggle-publish')}>
                          {course.published ? <EyeOff size={15} /> : <Globe size={15} />}
                        </button>
                      )}
                      <button className="text-button" style={{ ...iconButtonStyle, color: '#b42318' }} title="Delete course" aria-label={`Delete ${course.title}`} onClick={() => handleCourseAction(course, 'delete')}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  </AdminShell>
}

const inputStyle: React.CSSProperties = {
  height: 40, borderRadius: 8, border: '1px solid var(--line)', padding: '0 12px', fontSize: 13, background: '#fff',
}

const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#374151', display: 'flex', flexDirection: 'column', gap: 3 }
const selectStyle: React.CSSProperties = { height: 40, borderRadius: 8, border: '1px solid var(--line)', padding: '0 12px', fontSize: 13, background: '#fff' }
const smallInputStyle: React.CSSProperties = { height: 34, borderRadius: 7, border: '1px solid var(--line)', padding: '0 9px', fontSize: 12, background: '#fff', width: '100%' }
const iconButtonStyle: React.CSSProperties = { width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', verticalAlign: 'middle', borderRadius: 6 }
const fieldSetStyle: React.CSSProperties = { border: '1px solid var(--line)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }
const legendStyle: React.CSSProperties = { padding: '0 6px', fontSize: 13, fontWeight: 700 }
const helperStyle: React.CSSProperties = { color: 'var(--muted)', fontSize: 11, fontWeight: 400 }
