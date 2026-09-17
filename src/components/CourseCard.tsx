'use client'

import { BookOpen, Clock3 } from 'lucide-react'
import { useState } from 'react'

interface CourseCardProps {
  course: {
    id: string
    title: string
    label?: string
    duration?: string
    lessons?: string
    tone?: string
    progress?: number
    description?: string
    thumbnailUrl?: string
    coverImageUrl?: string | null
  }
  index?: number
  onClick: () => void
}

export default function CourseCard({ course, index = 0, onClick }: CourseCardProps) {
  const tone = course.tone || ['blue', 'mint', 'lilac', 'peach', 'violet'][index % 5]
  const progress = course.progress ?? 0
  const [thumbnailFailed, setThumbnailFailed] = useState(false)
  // Empty cover-image values should behave like no cover image so the Mux
  // thumbnail endpoint can provide the fallback frame.
  const thumbnailUrl = course.thumbnailUrl?.trim() || course.coverImageUrl?.trim() || `/api/mux/thumbnail/course/${course.id}`

  return (
    <button className="course-card" onClick={onClick}>
      <div className={`course-art ${tone}`}>
        {!thumbnailFailed && <img src={thumbnailUrl} alt="" onError={() => setThumbnailFailed(true)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', background: '#f2f4f7' }} />}
        <span className="art-label" style={!thumbnailFailed ? { position: 'relative', zIndex: 1, color: '#fff', background: 'rgba(15,23,42,.72)', borderRadius: 4, padding: '4px 7px' } : undefined}>{course.label || 'Course'}</span>
        {thumbnailFailed && <div className="art-shape"><BookOpen size={29} /></div>}
        {thumbnailFailed && <span className="art-number">0{index + 1}</span>}
      </div>
      <div className="course-card-body">
        <div className="course-meta">
          {course.duration && <span><Clock3 size={13} /> {course.duration}</span>}
          {course.lessons && <span>{course.lessons}</span>}
        </div>
        <h3>{course.title}</h3>
        {course.description && <p>{course.description}</p>}
        <div className="card-progress">
          <div><span>Your progress</span><strong>{progress}%</strong></div>
          <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
        </div>
      </div>
    </button>
  )
}
