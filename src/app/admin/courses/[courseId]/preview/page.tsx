'use client'

import { use, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, BookOpen, Clock3, Play, Video } from 'lucide-react'
import AdminShell from '@/components/AdminShell'
import VideoPlayer from '@/components/VideoPlayer'
import { courseTotalSeconds, formatClock } from '@/lib/format'
import type { ApiCourseModule, ApiLesson } from '@/types/api'

export default function AdminCoursePreviewPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()
  const [course, setCourse] = useState<any>(null)
  const [modules, setModules] = useState<ApiCourseModule[]>([])
  const [selected, setSelected] = useState<ApiLesson | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated' && session?.user?.role !== 'ATLAS_ADMIN' && session?.user?.role !== 'ATLAS_EMPLOYEE' && session?.user?.role !== 'INSTRUCTOR') { router.push('/dashboard'); return }
    if (status === 'authenticated') {
      fetch(`/api/admin/courses/${courseId}`).then(async (response) => {
        const data = await response.json()
        if (!response.ok || !data.course) throw new Error(data.error ?? 'Course not found')
        setCourse(data.course); setLoading(false)
      }).catch((error) => { setLoadError(error instanceof Error ? error.message : 'Unable to load course'); setLoading(false) })
      fetch(`/api/admin/courses/${courseId}/content`).then((response) => response.ok ? response.json() : { modules: [] }).then((data) => { setModules(data.modules ?? []); setSelected(data.modules?.[0]?.lessons?.[0] ?? null) }).catch(() => {})
    }
  }, [status, session, router, courseId])

  if (loading) return <AdminShell active="courses"><div className="page-wrap"><p>Loading preview...</p></div></AdminShell>
  if (!course) return <AdminShell active="courses"><div className="page-wrap"><p role="alert">{loadError || 'Course not found.'}</p></div></AdminShell>
  const activePlaybackId = selected?.muxPlaybackId ?? course.muxPlaybackId ?? ''
  const hasPlaybackId = Boolean(activePlaybackId)
  return <AdminShell active="courses"><div className="page-wrap detail-page">
    <button className="text-button" onClick={() => router.back()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16 }}><ArrowLeft size={16} /> Back</button>
    <div className="page-heading compact"><div><p className="eyebrow">Preview mode · progress is not recorded</p><h1>{course.title}</h1><p className="muted">{course.description}</p></div><span className={`badge ${course.published ? 'badge-active' : 'badge-inactive'}`}>{course.published ? 'Published' : 'Draft'}</span></div>
    <div className="lesson-layout"><div>{hasPlaybackId ? <VideoPlayer playbackId={activePlaybackId} courseId={courseId} lessonId={selected?.id} /> : <div className="video-stage"><div className="video-placeholder"><div className="play-large"><Play size={26} fill="currentColor" /></div><span>{selected?.title ?? 'No lesson selected'}</span><small>{selected ? 'Add a Mux playback ID to preview this video.' : 'Add a Mux playback ID to preview this video.'}</small></div></div>}<div className="panel" style={{ marginTop: 16 }}><p className="eyebrow">About this course</p><h2>{course.title}</h2><p className="muted">This is the learner-facing preview. Course progress and completion are disabled in this view.</p><div className="detail-meta"><span><Clock3 size={16} /> {formatClock(courseTotalSeconds(course))}</span><span><Video size={16} /> {modules.reduce((count, module) => count + module.lessons.length, 0)} lessons</span><span><BookOpen size={16} /> {modules.length} modules</span></div></div></div><aside className="lesson-list"><p className="eyebrow">Course content</p>{modules.map((module) => <div key={module.id}><p style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)', margin: '16px 0 4px' }}>{module.title}</p>{module.lessons.map((lesson) => <button key={lesson.id} className={`lesson ${selected?.id === lesson.id ? 'current' : ''}`} onClick={() => setSelected(lesson)}><span className="lesson-number">{lesson.sortOrder + 1}</span><span>{lesson.title}<small>{Math.round(lesson.durationSeconds / 60)} min</small></span></button>)}</div>)}{modules.length === 0 && course.muxPlaybackId && <p className="muted" style={{ fontSize: 12 }}>Course video is connected on the course level.</p>}</aside></div>
  </div></AdminShell>
}
