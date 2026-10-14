'use client'

import Link from 'next/link'
import { use, useEffect, useState } from 'react'
import { ArrowLeft, Clock3, Download, FileText, Play, Video } from 'lucide-react'
import AuthShell from '@/components/AuthShell'
import VideoPlayer from '@/components/VideoPlayer'
import type { ApiCourseResource } from '@/types/api'

type PreviewLesson = { id: string; title: string; description: string; durationSeconds: number; muxPlaybackId: string | null; sortOrder: number }
type PreviewModule = { id: string; title: string; description: string; sortOrder: number; lessons: PreviewLesson[] }
type PreviewCourse = {
  id: string
  title: string
  description: string
  coverImageUrl: string | null
  notes: string | null
  durationMinutes: number
  durationSeconds: number
  muxPlaybackId: string | null
  section: { name: string } | null
  modules: PreviewModule[]
  resources: ApiCourseResource[]
}

export default function SchoolParentCoursePreviewPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params)
  const [course, setCourse] = useState<PreviewCourse | null>(null)
  const [selectedLessonId, setSelectedLessonId] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setLoadError('')
    fetch(`/api/school/parents/courses/${courseId}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok || !data.course) throw new Error(data.error ?? 'Unable to load course.')
        setCourse(data.course)
        setSelectedLessonId(data.course.modules?.[0]?.lessons?.[0]?.id ?? '')
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setCourse(null)
        setLoadError(error instanceof Error ? error.message : 'Unable to load course.')
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [courseId])

  const lessons = course?.modules?.flatMap((module) => module.lessons) ?? []
  const selectedLesson = lessons.find((lesson) => lesson.id === selectedLessonId) ?? lessons[0]
  const activePlaybackId = selectedLesson?.muxPlaybackId ?? course?.muxPlaybackId ?? ''
  const hasPlaybackId = Boolean(activePlaybackId)
  const totalSeconds = lessons.reduce((total, lesson) => total + lesson.durationSeconds, 0)

  return <AuthShell active="Parents"><div className="page-wrap detail-page">
    <Link className="back-button" href="/school/parents" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16 }}><ArrowLeft size={16} /> Back to parents</Link>
    {loading ? <div style={{ padding: 40, opacity: .4 }}>Loading preview...</div> : !course ? <div role="alert" style={{ padding: 40 }}>{loadError || 'Unable to load course.'}</div> : <>
      <div className="detail-hero"><div><span className="tag tag-blue">{course.section?.name ?? 'Parent course'}</span><h1>{course.title}</h1><p>{course.description}</p><div className="detail-meta"><span><Clock3 size={16} /> {formatDuration(totalSeconds || course.durationSeconds)}</span><span><Video size={16} /> {lessons.length} {lessons.length === 1 ? 'lesson' : 'lessons'}</span></div></div><div className="detail-art blue"><img src={course.coverImageUrl || `/api/mux/thumbnail/course/${course.id}`} alt={`${course.title} thumbnail`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} /></div></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 16px', color: '#7b8494', fontSize: 12 }}><Play size={14} /> Preview mode · progress is not recorded. This is what parents see.</div>
      <div className="lesson-layout"><div>{hasPlaybackId ? <VideoPlayer key={`${courseId}-${selectedLesson?.id ?? 'course'}-${activePlaybackId}`} playbackId={activePlaybackId} courseId={courseId} lessonId={selectedLesson?.id} /> : <div className="video-stage"><div className="video-placeholder"><div className="play-large"><Play size={26} fill="currentColor" /></div><span>{selectedLesson?.title ?? 'No video connected'}</span><small>{selectedLesson ? 'Mux video is not connected for this lesson yet.' : 'This course has no video yet.'}</small></div></div>}
        {(Boolean(course.notes) || (course.resources?.length ?? 0) > 0) && <div className="panel course-materials" style={{ marginTop: 18 }}>
          {course.notes && <div className="course-notes"><div className="material-heading"><FileText size={18} /><h2>Notes</h2></div><p>{course.notes}</p></div>}
          {course.resources && course.resources.length > 0 && <div className="course-resources"><div className="material-heading"><Download size={18} /><h2>Resources</h2></div>{course.resources.map((resource) => <a className="resource-item" href={resource.url} download={resource.fileName || true} target="_blank" rel="noreferrer" key={resource.id}><span><strong>{resource.title}</strong><small>{resource.fileName || 'Download resource'}</small></span><Download size={16} /></a>)}</div>}
        </div>}
      </div>
        <aside className="lesson-list"><p className="eyebrow">Course content</p><h3>{lessons.length} {lessons.length === 1 ? 'Lesson' : 'Lessons'} · {formatDuration(totalSeconds || course.durationSeconds)}</h3>{course.modules?.map((module) => <div key={module.id}><p style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)', margin: '16px 0 4px' }}>{module.title}</p>{module.lessons.map((lesson, index) => <button key={lesson.id} className={`lesson ${lesson.id === selectedLesson?.id ? 'current' : ''}`} onClick={() => setSelectedLessonId(lesson.id)}><span className="lesson-number">{index + 1}</span><span>{lesson.title}<small>{formatDuration(lesson.durationSeconds)}</small></span><Play size={14} fill="currentColor" /></button>)}</div>)}{lessons.length === 0 && <p className="muted" style={{ fontSize: 12 }}>This course has no lessons yet.</p>}</aside>
      </div>
    </>}
  </div></AuthShell>
}

function formatDuration(seconds: number) { const mins = Math.floor(seconds / 60); return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60 ? `${mins % 60}m` : ''}` }
