'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { BookOpen, Plus, Search, Trash2, GripVertical } from 'lucide-react'
import AdminShell from '@/components/AdminShell'
import { useToast } from '@/components/Toast'
import type { AdminCourse, ApiCourseSection } from '@/types/api'

export default function AdminCoursesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [courses, setCourses] = useState<AdminCourse[]>([])
  const [sections, setSections] = useState<ApiCourseSection[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ slug: '', title: '', description: '', durationMinutes: 20, muxPlaybackId: '', notes: '' })
  const [resources, setResources] = useState<{ title: string; description: string; url: string; fileName: string; sortOrder: number }[]>([])
  const [modules, setModules] = useState<{ title: string; description: string; sortOrder: number; lessons: { title: string; description: string; durationSeconds: number; sortOrder: number }[] }[]>([])
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sectionFilter, setSectionFilter] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated' && session?.user?.role !== 'ATLAS_ADMIN' && session?.user?.role !== 'INSTRUCTOR') { router.push('/dashboard'); return }
    if (status === 'authenticated') {
      Promise.all([fetch('/api/admin/courses').then((r) => r.json()), session?.user?.role === 'ATLAS_ADMIN' ? fetch('/api/admin/course-sections').then((r) => r.json()) : Promise.resolve({ sections: [] })]).then(([courseData, sectionData]) => { setCourses(courseData.courses ?? []); setSections(sectionData.sections ?? []); setLoading(false) }).catch(() => setLoading(false))
    }
  }, [status, session, router])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const res = await fetch('/api/admin/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, durationMinutes: Number(form.durationMinutes), modules, resources }),
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
      setError(message)
      toast(message, 'error')
      return
    }
    setCourses([data.course, ...courses])
    setShowCreate(false)
    setForm({ slug: '', title: '', description: '', durationMinutes: 20, muxPlaybackId: '', notes: '' })
    setModules([])
    setResources([])
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
    const hasProgress = course.progressCount > 0
    const confirmed = window.confirm(
      hasProgress
        ? `Unpublish and archive "${course.title}"? This removes it from schools. The ${course.progressCount} existing learner record${course.progressCount === 1 ? '' : 's'} will be preserved.`
        : `Delete "${course.title}"? This course has no learner progress and will be permanently removed.`
    )
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
    const matchesStatus = !statusFilter || (statusFilter === 'published' ? c.published : !c.published)
    const matchesSection = !sectionFilter || c.sectionId === sectionFilter
    return matchesSearch && matchesStatus && matchesSection
  })

  return <AdminShell active="courses">
    <div className="page-wrap">
      <div className="page-heading">
        <div><p className="eyebrow">Course management</p><h1>Courses</h1><p className="muted">Build, preview and organize Atlas learning content.</p></div>
        <button className="primary-button" onClick={() => setShowCreate(!showCreate)}><Plus size={17} /> Add course</button>
      </div>

      {showCreate && (
        <div className="panel" style={{ marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 16px' }}>Create new course</h3>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 500 }}>
            <input placeholder="Slug (e.g. ai-intro)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') })} required style={inputStyle} />
            <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required style={inputStyle} />
            <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required style={{ ...inputStyle, height: 80, paddingTop: 10, resize: 'vertical' }} />
            <input placeholder="Duration (minutes)" type="number" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })} required style={inputStyle} />
            <input placeholder="Mux playback ID (optional)" value={form.muxPlaybackId} onChange={(e) => setForm({ ...form, muxPlaybackId: e.target.value })} style={inputStyle} />
            <label style={labelStyle}>Learner notes<textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes learners should read below the video player" style={{ ...inputStyle, height: 90, paddingTop: 10, resize: 'vertical' }} /></label>

            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}><h4 style={{ margin: 0, fontSize: 14 }}>Downloadable resources</h4><button type="button" className="secondary-button" style={{ height: 32, fontSize: 12 }} onClick={() => setResources([...resources, { title: '', description: '', url: '', fileName: '', sortOrder: resources.length }])}><Plus size={14} /> Add resource</button></div>{resources.map((resource, index) => <div className="course-create-resource-row" key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr 32px', gap: 7, marginBottom: 8 }}><input placeholder="Resource title" value={resource.title} onChange={(e) => { const next = [...resources]; next[index] = { ...next[index], title: e.target.value }; setResources(next) }} style={smallInputStyle} /><input placeholder="Download URL" type="url" value={resource.url} onChange={(e) => { const next = [...resources]; next[index] = { ...next[index], url: e.target.value }; setResources(next) }} style={smallInputStyle} /><input placeholder="File name (optional)" value={resource.fileName} onChange={(e) => { const next = [...resources]; next[index] = { ...next[index], fileName: e.target.value }; setResources(next) }} style={smallInputStyle} /><button type="button" className="icon-button" aria-label="Remove resource" onClick={() => setResources(resources.filter((_, resourceIndex) => resourceIndex !== index))}><Trash2 size={14} /></button></div>)}</div>

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
                    {mod.lessons.map((lesson, li) => (
                      <div key={li} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                        <input placeholder="Lesson title" value={lesson.title} onChange={(e) => { const m = [...modules]; m[mi].lessons[li] = { ...m[mi].lessons[li], title: e.target.value }; setModules(m) }} style={{ ...inputStyle, flex: 1, fontSize: 12, height: 34 }} />
                        <input placeholder="Duration sec" type="number" value={lesson.durationSeconds || ''} onChange={(e) => { const m = [...modules]; m[mi].lessons[li] = { ...m[mi].lessons[li], durationSeconds: Number(e.target.value) }; setModules(m) }} style={{ ...inputStyle, width: 100, fontSize: 12, height: 34 }} />
                        <button type="button" className="icon-button" onClick={() => { const m = [...modules]; m[mi].lessons = m[mi].lessons.filter((_, j) => j !== li); setModules(m) }}><Trash2 size={13} style={{ color: '#e53e3e' }} /></button>
                      </div>
                    ))}
                    <button type="button" className="text-button" style={{ fontSize: 12 }} onClick={() => { const m = [...modules]; m[mi].lessons = [...m[mi].lessons, { title: `Lesson ${m[mi].lessons.length + 1}`, description: '', durationSeconds: 0, sortOrder: m[mi].lessons.length }]; setModules(m) }}>
                      <Plus size={13} /> Add lesson
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {error && <p style={{ color: '#e53e3e', margin: 0, fontSize: 13 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="primary-button">Create course</button>
              <button type="button" className="secondary-button" onClick={() => { setShowCreate(false); setModules([]); setResources([]) }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
      <div className="top-search" style={{ width: '100%', maxWidth: 360 }}>
        <Search size={17} />
        <input placeholder="Search courses..." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search courses" />
      </div>
      <select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)} style={selectStyle}><option value="">All sections</option>{sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}</select>
      <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}><option value="">All statuses</option><option value="published">Published</option><option value="draft">Draft</option></select>
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
                <th>Section</th>
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
                  <td>{course.section?.name ?? <span style={{ color: 'var(--muted)' }}>Unsectioned</span>}</td>
                  <td>{course.durationMinutes} min</td>
                  <td><span className={`badge ${course.published ? 'badge-active' : 'badge-inactive'}`}>{course.published ? 'Published' : 'Unpublished'}</span></td>
                  <td>{course.schoolAccessCount}</td>
                  <td>{course.progressCount}</td>
                  <td>
                    <select
                      aria-label={`Actions for ${course.title}`}
                      defaultValue=""
                      style={{ ...selectStyle, minWidth: 140, height: 36, fontSize: 12 }}
                      onChange={(event) => {
                        const action = event.currentTarget.value
                        event.currentTarget.value = ''
                        handleCourseAction(course, action)
                      }}
                    >
                      <option value="" disabled>Choose action</option>
                      <option value="preview">Preview course</option>
                      <option value="edit">Edit course</option>
                      {session?.user?.role === 'ATLAS_ADMIN' && <option value="toggle-publish">{course.published ? 'Unpublish' : 'Publish'}</option>}
                      <option value="delete" style={{ color: '#dc2626' }}>Delete course</option>
                    </select>
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
  height: 40, borderRadius: 8, border: '1px solid var(--line)', padding: '0 12px', fontSize: 13, background: '#00000',
}

const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#374151', display: 'flex', flexDirection: 'column', gap: 3 }
const selectStyle: React.CSSProperties = { height: 40, borderRadius: 8, border: '1px solid var(--line)', padding: '0 12px', fontSize: 13, background: '#00000' }
const smallInputStyle: React.CSSProperties = { height: 34, borderRadius: 7, border: '1px solid var(--line)', padding: '0 9px', fontSize: 12, background: '#00000', width: '100%' }
