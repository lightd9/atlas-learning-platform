'use client'

import Link from 'next/link'
import { use, useCallback, useEffect, useState } from 'react'
import { ArrowLeft, BookOpen, CheckCircle2, Clock3, Download, FileText, Play, ShieldCheck, Video } from 'lucide-react'
import AuthShell from '@/components/AuthShell'
import VideoPlayer from '@/components/VideoPlayer'
import { apiErrorMessage } from '@/lib/api-response'
import type { ApiCourse, ApiLesson } from '@/types/api'

const tones = ['blue', 'mint', 'lilac', 'peach', 'violet']

export default function CourseDetailPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params)
  const [course, setCourse] = useState<ApiCourse | null>(null)
  const [selectedLessonId, setSelectedLessonId] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [progressSaveError, setProgressSaveError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setLoadError('')
    fetch(`/api/courses/${courseId}`, { signal: controller.signal }).then(async (response) => {
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.course) {
        throw new Error(apiErrorMessage(response.status, data.error, 'Unable to load course.'))
      }
      setCourse(data.course)
      setSelectedLessonId(data.course.modules?.[0]?.lessons?.[0]?.id ?? '')
    }).catch((error) => {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setCourse(null)
      setLoadError(error instanceof Error ? error.message : 'Unable to load course.')
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [courseId])

  const lessons = course?.modules?.flatMap((module) => module.lessons) ?? []
  const selectedLesson = lessons.find((lesson) => lesson.id === selectedLessonId) ?? lessons[0]
  const lessonProgress = selectedLesson?.progress?.[0]
  const courseProgress = course?.progress?.[0]
  const totalMins = course?.durationMinutes ?? 0
  const progressPercent = courseProgress ? Math.round(Number(courseProgress.percentComplete)) : 0

  const handleProgress = useCallback(async (watchedSeconds: number, durationSeconds: number, watchedRanges: { start: number; end: number }[] = []) => {
    if (!selectedLesson) return
    try {
      const response = await fetch('/api/progress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courseId, lessonId: selectedLesson.id, watchedSeconds, durationSeconds: durationSeconds || selectedLesson.durationSeconds, watchedRanges }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Unable to save your progress.')
      setProgressSaveError('')
    } catch (error) {
      setProgressSaveError(error instanceof Error ? error.message : 'Unable to save your progress.')
    }
  }, [courseId, selectedLesson])

  return <AuthShell active="My learning"><div className="page-wrap detail-page">
    <Link className="back-button" href="/courses" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16 }}><ArrowLeft size={16} /> Back to courses</Link>
    {loading ? <div style={{ padding: 40, opacity: .4 }}>Loading course...</div> : !course ? <div role="alert" style={{ padding: 40 }}>{loadError || 'Unable to load course.'}</div> : <>
      <div className="detail-hero"><div><span className={`tag tag-${tones[0]}`}>{course.section?.name ?? 'Course'}</span><h1>{course.title}</h1><p>{course.description} Learn through structured modules and focused video lessons.</p><div className="detail-meta"><span><Clock3 size={16} /> {formatDuration(totalMins * 60)}</span><span><Video size={16} /> {lessons.length} lessons</span><span><ShieldCheck size={16} /> Designed for schools</span>{progressPercent > 0 && <span><CheckCircle2 size={16} /> {progressPercent}% complete</span>}</div></div><div className={`detail-art ${tones[0]}`}><div className="art-shape"><BookOpen size={56} /></div><span>ATLAS<br />LEARNING</span></div></div>
      <div className="lesson-layout"><div>{selectedLesson?.muxPlaybackId ? <VideoPlayer playbackId={selectedLesson.muxPlaybackId} courseId={courseId} lessonId={selectedLesson.id} initialPosition={lessonProgress?.watchedSeconds || 0} onProgress={handleProgress} /> : <div className="video-stage"><div className="video-placeholder"><div className="play-large"><Play size={26} fill="currentColor" /></div><span>{selectedLesson?.title ?? 'Select a lesson'}</span><small>{selectedLesson ? 'Mux video is not connected for this lesson yet.' : 'Add lessons from the admin course editor.'}</small></div></div>}
        {progressSaveError && <p role="alert" className="form-error" style={{ marginTop: 12 }}>Progress was not saved: {progressSaveError}</p>}
        {(Boolean(course.notes) || (course.resources?.length ?? 0) > 0) && <div className="panel course-materials" style={{ marginTop: 18 }}>
          {course.notes && <div className="course-notes"><div className="material-heading"><FileText size={18} /><h2>Notes</h2></div><p>{course.notes}</p></div>}
          {course.resources && course.resources.length > 0 && <div className="course-resources"><div className="material-heading"><Download size={18} /><h2>Resources</h2></div>{course.resources.map((resource) => <a className="resource-item" href={resource.url} download={resource.fileName || true} target="_blank" rel="noreferrer" key={resource.id}><span><strong>{resource.title}</strong><small>{resource.fileName || 'Download resource'}</small></span><Download size={16} /></a>)}</div>}
        </div>}
      </div>
        <aside className="lesson-list"><p className="eyebrow">Course content</p><h3>{lessons.length} lessons · {formatDuration(totalMins * 60)}</h3>{course.modules?.map((module) => <div key={module.id}><p style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)', margin: '16px 0 4px' }}>{module.title}</p>{module.lessons.map((lesson, index) => <LessonButton key={lesson.id} lesson={lesson} index={index} selected={lesson.id === selectedLesson?.id} onClick={() => setSelectedLessonId(lesson.id)} />)}</div>)}{lessons.length === 0 && <p className="muted" style={{ fontSize: 12 }}>This course has no lessons yet.</p>}</aside>
      </div>
    </>}
  </div></AuthShell>
}

function LessonButton({ lesson, index, selected, onClick }: { lesson: ApiLesson; index: number; selected: boolean; onClick: () => void }) {
  const complete = lesson.progress?.[0]?.status === 'COMPLETED'
  return <button className={`lesson ${selected ? 'current' : ''}`} onClick={onClick}><span className="lesson-number">{index + 1}</span><span>{lesson.title}<small>{formatDuration(lesson.durationSeconds)}</small></span>{complete ? <CheckCircle2 size={16} className="lesson-check" /> : <Play size={14} fill="currentColor" />}</button>
}

function formatDuration(seconds: number) { const mins = Math.floor(seconds / 60); return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60 ? `${mins % 60}m` : ''}` }
