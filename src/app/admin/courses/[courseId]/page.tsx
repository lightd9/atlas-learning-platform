'use client'

import { use, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Plus, Trash2, Video, ChevronDown } from 'lucide-react'
import AdminShell from '@/components/AdminShell'
import { useToast } from '@/components/Toast'
import LessonVideoUploader from '@/components/LessonVideoUploader'
import DurationInput from '@/components/DurationInput'
import { courseTotalSeconds } from '@/lib/format'
import type { AdminCourse, ApiCourseSection, ApiCourseModule, ApiCourseResource, ApiLesson } from '@/types/api'

export default function AdminCourseEditPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [course, setCourse] = useState<AdminCourse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', durationSeconds: 1200, published: true, muxPlaybackId: '', sectionId: '', notes: '' })
  const [sections, setSections] = useState<ApiCourseSection[]>([])
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([])
  const [modules, setModules] = useState<ApiCourseModule[]>([])
  const [contentSaving, setContentSaving] = useState(false)
  const [contentSaved, setContentSaved] = useState(false)
  const [contentError, setContentError] = useState('')
  const [resources, setResources] = useState<ApiCourseResource[]>([])
  const [resourceForm, setResourceForm] = useState({ title: '', description: '', url: '', fileName: '' })
  const [resourceError, setResourceError] = useState('')
  const [selectedSchoolIds, setSelectedSchoolIds] = useState<string[]>([])
  const [savedSchoolIds, setSavedSchoolIds] = useState<string[]>([])
  const [accessSaving, setAccessSaving] = useState(false)
  const [accessSaved, setAccessSaved] = useState(false)
  const [playbackCheck, setPlaybackCheck] = useState<Record<string, { checking: boolean; valid?: boolean; error?: string }>>({})

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated' && session?.user?.role !== 'ATLAS_ADMIN' && session?.user?.role !== 'INSTRUCTOR') { router.push('/dashboard'); return }
    if (status === 'authenticated') {
      fetch(`/api/admin/courses/${courseId}`).then(async (response) => {
        const d = await response.json()
        if (!response.ok || !d.course) throw new Error(d.error ?? 'Unable to load course')
        return d
      }).then((d) => {
        const c = d.course
        setCourse(c)
        setForm({ title: c.title, description: c.description, durationSeconds: courseTotalSeconds(c), published: c.published, muxPlaybackId: c.muxPlaybackId || '', sectionId: c.sectionId || '', notes: c.notes || '' })
        setResources(c.resources ?? [])
        Promise.all([fetch('/api/admin/course-sections').then((r) => r.json()), fetch(`/api/admin/courses/${courseId}/content`).then((r) => r.json()), fetch('/api/admin/schools').then((r) => r.json())]).then(([sectionData, contentData, schoolData]) => {
          setSections(sectionData.sections ?? []); setModules(contentData.modules ?? [])
          const availableSchools = (schoolData.schools ?? []).map((school: any) => ({ id: school.id, name: school.name }))
          setSchools(availableSchools)
          const accessBySchool = new Map((c.schoolAccess ?? []).map((entry: any) => [entry.schoolId, entry.enabled]))
          const savedIds = availableSchools.filter((school: any) => accessBySchool.get(school.id) ?? true).map((school: any) => school.id)
          setSelectedSchoolIds(savedIds)
          setSavedSchoolIds(savedIds)
        }).finally(() => setLoading(false))
      }).catch((error) => { setLoadError(error instanceof Error ? error.message : 'Unable to load course'); setLoading(false) })
    }
  }, [status, session, router, courseId])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    const res = await fetch(`/api/admin/courses/${courseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, durationMinutes: Math.max(1, Math.round(form.durationSeconds / 60)) }),
    })
    setSaving(false)
    if (res.ok) { setSaved(true); toast('Changes saved', 'success') }
    else toast('Unable to save course', 'error')
  }

  function addModule() {
    setModules([...modules, { id: `new-module-${Date.now()}`, title: `Module ${modules.length + 1}`, description: '', sortOrder: modules.length, lessons: [] }])
  }

  function addLesson(moduleId: string) {
    setModules(modules.map((module) => module.id === moduleId ? { ...module, lessons: [...module.lessons, { id: `new-lesson-${Date.now()}`, title: `Lesson ${module.lessons.length + 1}`, description: '', durationSeconds: 0, muxPlaybackId: '', sortOrder: module.lessons.length, published: true, progress: [] }] } : module))
  }

  function updateModule(moduleId: string, patch: Partial<ApiCourseModule>) { setModules(modules.map((module) => module.id === moduleId ? { ...module, ...patch } : module)) }
  function updateLesson(moduleId: string, lessonId: string, patch: Partial<ApiLesson>) { setModules(modules.map((module) => module.id === moduleId ? { ...module, lessons: module.lessons.map((lesson) => lesson.id === lessonId ? { ...lesson, ...patch } : lesson) } : module)) }
  function removeModule(moduleId: string) { setModules(modules.filter((module) => module.id !== moduleId).map((module, index) => ({ ...module, sortOrder: index }))) }
  function removeLesson(moduleId: string, lessonId: string) { setModules(modules.map((module) => module.id === moduleId ? { ...module, lessons: module.lessons.filter((lesson) => lesson.id !== lessonId).map((lesson, index) => ({ ...lesson, sortOrder: index })) } : module)) }

  async function checkPlayback(moduleId: string, lessonId: string) {
    const playbackId = modules.find((module) => module.id === moduleId)?.lessons.find((lesson) => lesson.id === lessonId)?.muxPlaybackId
    if (!playbackId) return
    setPlaybackCheck((prev) => ({ ...prev, [lessonId]: { checking: true } }))
    try {
      const res = await fetch(`/api/mux/validate-playback?playbackId=${encodeURIComponent(playbackId)}`)
      const data = await res.json()
      setPlaybackCheck((prev) => ({ ...prev, [lessonId]: { checking: false, valid: Boolean(data.valid), error: data.error } }))
    } catch {
      setPlaybackCheck((prev) => ({ ...prev, [lessonId]: { checking: false, valid: false, error: 'Could not validate playback ID' } }))
    }
  }

  async function saveContent() {
    setContentSaving(true); setContentSaved(false); setContentError('')
    const payload = { modules: modules.map((module, moduleIndex) => ({ ...module, id: module.id.startsWith('new-') ? undefined : module.id, sortOrder: moduleIndex, lessons: module.lessons.map((lesson, lessonIndex) => ({ ...lesson, id: lesson.id.startsWith('new-') ? undefined : lesson.id, sortOrder: lessonIndex })) })) }
    const res = await fetch(`/api/admin/courses/${courseId}/content`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json()
    setContentSaving(false)
    if (!res.ok) { const message = data.error ?? 'Unable to save course content'; setContentError(message); toast(message, 'error'); return }
    setModules(data.modules ?? modules); setContentSaved(true); toast('Course content saved', 'success')
  }

  async function saveSchoolAccess() {
    setAccessSaving(true); setAccessSaved(false)
    const response = await fetch('/api/admin/school-access', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courseId, schoolIds: selectedSchoolIds }) })
    setAccessSaving(false)
    if (response.ok) {
      setAccessSaved(true)
      setSavedSchoolIds([...selectedSchoolIds])
      const refreshed = await fetch(`/api/admin/courses/${courseId}`).then((r) => r.json())
      setCourse(refreshed.course)
      toast('Course access saved', 'success')
    } else toast('Unable to save course access', 'error')
  }

  function discardSchoolAccessChanges() {
    setSelectedSchoolIds([...savedSchoolIds])
    setAccessSaved(false)
    toast('Changes discarded', 'info')
  }

  const schoolAccessDirty = selectedSchoolIds.length !== savedSchoolIds.length || selectedSchoolIds.some((id) => !savedSchoolIds.includes(id))

  async function addResource(event: React.FormEvent) {
    event.preventDefault(); setResourceError('')
    const res = await fetch(`/api/admin/courses/${courseId}/resources`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...resourceForm, sortOrder: resources.length }) })
    const data = await res.json()
    if (!res.ok) { const message = data.error ?? 'Unable to add resource'; setResourceError(message); toast(message, 'error'); return }
    setResources([...resources, data.resource]); setResourceForm({ title: '', description: '', url: '', fileName: '' }); toast('Resource added', 'success')
  }

  async function deleteResource(resourceId: string) {
    const res = await fetch(`/api/admin/courses/${courseId}/resources?resourceId=${resourceId}`, { method: 'DELETE' })
    if (res.ok) { setResources(resources.filter((resource) => resource.id !== resourceId)); toast('Resource removed', 'success') }
    else toast('Unable to remove resource', 'error')
  }

  return <AdminShell active="courses">
    <div className="page-wrap">
      <button className="text-button" onClick={() => router.push('/admin/courses')} style={{ marginBottom: 16, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <ArrowLeft size={16} /> Back to courses
      </button>

      {loading ? <p>Loading...</p> : !course ? <p role="alert">{loadError || 'Course not found.'}</p> : (
        <>
          <div className="page-heading">
            <div><p className="eyebrow">Course management</p><h1>Edit course</h1></div>
            <button className="secondary-button" onClick={() => router.push(`/admin/courses/${courseId}/preview`)}>Preview course</button>
          </div>

          <div className="course-editor-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>
            <form onSubmit={handleSave} className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <label style={labelStyle}>
                Title
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required style={inputStyle} />
              </label>
              <label style={labelStyle}>
                Description
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required style={{ ...inputStyle, height: 100, paddingTop: 10, resize: 'vertical' }} />
              </label>
              <label style={labelStyle}>
                Learner notes
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes learners should read below the video player" style={{ ...inputStyle, height: 100, paddingTop: 10, resize: 'vertical' }} />
              </label>
              <label style={labelStyle}>
                Duration (minutes and seconds)
                <DurationInput totalSeconds={form.durationSeconds} onChange={(totalSeconds) => setForm({ ...form, durationSeconds: totalSeconds })} />
              </label>
              <label style={labelStyle}>
                Course section
                <select value={form.sectionId} onChange={(e) => setForm({ ...form, sectionId: e.target.value })} style={inputStyle}>
                  <option value="">Unsectioned</option>{sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
                </select>
              </label>
              <label style={labelStyle}>
                Mux Playback ID
                <input value={form.muxPlaybackId} onChange={(e) => setForm({ ...form, muxPlaybackId: e.target.value })} placeholder="e.g. fV2K7U6G00G02T1BU00200Z00C00G" style={inputStyle} />
              </label>
              <label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} />
                Published (visible to schools)
              </label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button type="submit" className="primary-button" disabled={saving}>
                  <Save size={17} /> {saving ? 'Saving...' : 'Save changes'}
                </button>
                {saved && <span style={{ color: 'var(--green)', fontSize: 13 }}>Saved!</span>}
              </div>
            </form>

            <div>
              {session?.user?.role === 'ATLAS_ADMIN' && <div className="panel" style={{ marginBottom: 16 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>School access</h3>
                <p className="muted" style={{ fontSize: 12 }}>Courses are available to every active school by default. Change the selection to create school-specific access rules.</p>
                {schools.length > 0 ? (
                  <>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, marginBottom: 8 }}><button className="text-button" onClick={() => setSelectedSchoolIds(schools.map((school) => school.id))}>Select all</button><button className="text-button" onClick={() => setSelectedSchoolIds([])}>Deselect all</button><span className="muted" style={{ marginLeft: 'auto', fontSize: 11 }}>{selectedSchoolIds.length}/{schools.length} selected</span></div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {schools.map((school) => {
                      return <label key={school.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)', fontSize: 13 }}>
                        <span>{school.name}</span><input type="checkbox" checked={selectedSchoolIds.includes(school.id)} onChange={(e) => setSelectedSchoolIds(e.target.checked ? [...selectedSchoolIds, school.id] : selectedSchoolIds.filter((id) => id !== school.id))} aria-label={`Enable ${course.title} for ${school.name}`} />
                      </label>
                    })}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                    <button className="primary-button" onClick={saveSchoolAccess} disabled={accessSaving || !schoolAccessDirty}><Save size={16} /> {accessSaving ? 'Saving...' : 'Save changes'}</button>
                    <button className="secondary-button" onClick={discardSchoolAccessChanges} disabled={accessSaving || !schoolAccessDirty}>Discard changes</button>
                    {accessSaved && <span style={{ color: 'var(--green)', fontSize: 12 }}>Saved</span>}
                  </div>
                  </>
                ) : (
                  <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>No school-specific access configured. Course is available to all schools by default.</p>
                )}
              </div>}

              <div className="panel">
                <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>Stats</h3>
                <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span>Enrollments: <strong>{course.progressCount}</strong></span>
                  <span>School access entries: <strong>{course.schoolAccessCount}</strong></span>
                </div>
              </div>
            </div>
          </div>

          <section className="panel" style={{ marginTop: 24 }}>
            <div className="panel-head">
              <div><p className="eyebrow">Learning structure</p><h3>Modules & lessons</h3><p className="muted" style={{ fontSize: 12 }}>Build the real course content learners will see. Each lesson can have its own Mux playback ID and duration.</p></div>
              <button className="secondary-button" onClick={addModule}><Plus size={16} /> Add module</button>
            </div>
            {modules.length === 0 && <div style={{ border: '1px dashed #cdd6e5', borderRadius: 10, padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No modules yet. Add a module to start building this course.</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {modules.map((module, moduleIndex) => <div key={module.id} style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ background: '#f8f9fc', padding: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
                  <ChevronDown size={16} color="var(--muted)" />
                  <input aria-label={`Module ${moduleIndex + 1} title`} value={module.title} onChange={(e) => updateModule(module.id, { title: e.target.value })} style={{ ...inputStyle, marginTop: 0, flex: 1, fontWeight: 600 }} />
                  <button className="icon-button" aria-label={`Delete ${module.title}`} onClick={() => removeModule(module.id)}><Trash2 size={16} /></button>
                </div>
                <div style={{ padding: '10px 14px 14px' }}>
                  <input aria-label={`${module.title} description`} value={module.description ?? ''} onChange={(e) => updateModule(module.id, { description: e.target.value })} placeholder="Optional module description" style={{ ...inputStyle, marginTop: 0, marginBottom: 10 }} />
                  {module.lessons.map((lesson, lessonIndex) => <div className="lesson-editor-row" key={lesson.id} style={{ padding: '14px 0', borderTop: '1px solid #edf0f5' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '26px 1fr 1.1fr 148px 36px', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>{lessonIndex + 1}</span>
                      <input aria-label="Lesson title" value={lesson.title} onChange={(e) => updateLesson(module.id, lesson.id, { title: e.target.value })} placeholder="Lesson title" style={smallInputStyle} />
                      <input aria-label="Lesson description" value={lesson.description ?? ''} onChange={(e) => updateLesson(module.id, lesson.id, { description: e.target.value })} placeholder="Description" style={smallInputStyle} />
                      <DurationInput compact totalSeconds={lesson.durationSeconds} onChange={(totalSeconds) => updateLesson(module.id, lesson.id, { durationSeconds: totalSeconds })} />
                      <button className="icon-button" aria-label={`Delete ${lesson.title}`} onClick={() => removeLesson(module.id, lesson.id)}><Trash2 size={15} /></button>
                    </div>
                    <div style={{ margin: '10px 0 0 34px' }}>
                      {lesson.id.startsWith('new-') ? <div style={{ border: '1px dashed var(--line)', borderRadius: 9, padding: 12, color: 'var(--muted)', fontSize: 12 }}><Video size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />Save modules & lessons before uploading a video.</div> : <LessonVideoUploader courseId={courseId} lessonId={lesson.id} currentPlaybackId={lesson.muxPlaybackId} onReady={(playbackId, durationSeconds) => updateLesson(module.id, lesson.id, { muxPlaybackId: playbackId, ...(durationSeconds ? { durationSeconds } : {}) })} />}
                      <details style={{ marginTop: 8 }}><summary style={{ cursor: 'pointer', color: 'var(--muted)', fontSize: 11 }}>Advanced: manual Playback ID</summary><div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 7 }}><input aria-label="Mux playback ID" value={lesson.muxPlaybackId ?? ''} onChange={(e) => { updateLesson(module.id, lesson.id, { muxPlaybackId: e.target.value }); setPlaybackCheck((prev) => { const next = { ...prev }; delete next[lesson.id]; return next }) }} placeholder="Mux playback ID" style={{ ...smallInputStyle, width: 'auto', flex: 1 }} /><button type="button" className="secondary-button" style={{ height: 34, whiteSpace: 'nowrap', fontSize: 12 }} disabled={!lesson.muxPlaybackId || Boolean(playbackCheck[lesson.id]?.checking)} onClick={() => checkPlayback(module.id, lesson.id)}>{playbackCheck[lesson.id]?.checking ? 'Checking…' : 'Test playback ID'}</button></div>{playbackCheck[lesson.id] && !playbackCheck[lesson.id].checking && <p role="status" style={{ fontSize: 12, marginTop: 6, color: playbackCheck[lesson.id].valid ? 'var(--green)' : '#b42318' }}>{playbackCheck[lesson.id].valid ? 'Playback ID is valid' : playbackCheck[lesson.id].error ?? 'Invalid playback ID'}</p>}<p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>Find this in the Mux dashboard under <strong>Assets</strong> → your video → <strong>Playback ID</strong>. Only IDs from this Mux account play.</p></details>
                    </div>
                  </div>)}
                  <button className="text-button" onClick={() => addLesson(module.id)} style={{ marginTop: 8 }}><Plus size={15} /> Add lesson</button>
                </div>
              </div>)}
            </div>
            {contentError && <p role="alert" style={{ color: '#b42318', fontSize: 12 }}>{contentError}</p>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18 }}><button className="primary-button" onClick={saveContent} disabled={contentSaving}><Save size={16} /> {contentSaving ? 'Saving content...' : 'Save modules & lessons'}</button>{contentSaved && <span style={{ color: 'var(--green)', fontSize: 13 }}>Content saved</span>}</div>
          </section>

          <section className="panel" style={{ marginTop: 24 }}>
            <div className="panel-head"><div><p className="eyebrow">Learning materials</p><h3>Downloadable resources</h3><p className="muted" style={{ fontSize: 12 }}>Add links to PDFs, worksheets, templates or other files learners should download.</p></div></div>
            {resources.length > 0 && <div style={{ marginBottom: 18 }}>{resources.map((resource) => <div key={resource.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--line)' }}><div style={{ flex: 1 }}><strong style={{ fontSize: 13 }}>{resource.title}</strong><small style={{ display: 'block', color: 'var(--muted)', marginTop: 3 }}>{resource.fileName || resource.url}</small></div><button className="text-button" onClick={() => deleteResource(resource.id)} style={{ color: '#b42318' }}>Remove</button></div>)}</div>}
            <form className="resource-form" onSubmit={addResource} style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr auto', gap: 8, alignItems: 'end' }}><label style={labelStyle}>Title<input required value={resourceForm.title} onChange={(e) => setResourceForm({ ...resourceForm, title: e.target.value })} placeholder="Course worksheet" style={smallInputStyle} /></label><label style={labelStyle}>Download URL<input required type="url" value={resourceForm.url} onChange={(e) => setResourceForm({ ...resourceForm, url: e.target.value })} placeholder="https://..." style={smallInputStyle} /></label><label style={labelStyle}>File name<input value={resourceForm.fileName} onChange={(e) => setResourceForm({ ...resourceForm, fileName: e.target.value })} placeholder="worksheet.pdf" style={smallInputStyle} /></label><button className="secondary-button" type="submit"><Plus size={15} /> Add</button></form>
            {resourceError && <p role="alert" style={{ color: '#b42318', fontSize: 12 }}>{resourceError}</p>}
          </section>
        </>
      )}
    </div>
  </AdminShell>
}

const inputStyle: React.CSSProperties = {
  height: 40, borderRadius: 8, border: '1px solid var(--line)', padding: '0 12px', fontSize: 13, background: '#00000', width: '100%', marginTop: 4,
}

const labelStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: '#374151', display: 'flex', flexDirection: 'column',
}

const smallInputStyle: React.CSSProperties = { height: 34, borderRadius: 7, border: '1px solid var(--line)', padding: '0 9px', fontSize: 12, background: '#00000', width: '100%' }
