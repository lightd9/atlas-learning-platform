'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowUpRight, CheckCircle2, Clock3, Play } from 'lucide-react'
import AuthShell from '@/components/AuthShell'
import type { ApiCourse } from '@/types/api'

export default function ProgressPage() {
  const [courses, setCourses] = useState<ApiCourse[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/courses').then((response) => response.json()).then((data) => setCourses(data.courses ?? [])).finally(() => setLoading(false))
  }, [])

  const completed = courses.filter((course) => course.progress?.[0]?.status === 'COMPLETED')
  const inProgress = courses.filter((course) => course.progress?.[0]?.status === 'IN_PROGRESS')

  return <AuthShell active="Progress"><div className="page-wrap">
    <div className="page-heading compact"><div><p className="eyebrow">Learning record</p><h1>Your progress</h1><p className="muted">Pick up active courses or review the learning you have completed.</p></div><Link className="primary-button" href="/courses">Explore courses <ArrowUpRight size={16} /></Link></div>
    {loading ? <div className="course-grid">{[0, 1, 2].map((item) => <div className="course-card" style={{ height: 240, opacity: .4 }} key={item} />)}</div> : <>
      <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 28 }}><div className="metric-card"><Play size={18} /><span>In progress</span><strong>{inProgress.length}</strong></div><div className="metric-card"><CheckCircle2 size={18} /><span>Completed</span><strong>{completed.length}</strong></div><div className="metric-card"><Clock3 size={18} /><span>Total courses</span><strong>{courses.length}</strong></div></div>
      <section className="panel"><div className="panel-head"><div><p className="eyebrow">Course history</p><h2>All learning activity</h2></div></div>{courses.length === 0 ? <p className="muted">No courses are currently available.</p> : <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{courses.map((course) => { const progress = course.progress?.[0]; const percent = Math.round(Number(progress?.percentComplete ?? 0)); return <div key={course.id} style={{ display: 'flex', alignItems: 'center', gap: 14, borderBottom: '1px solid var(--line)', padding: '12px 0' }}><div style={{ flex: 1 }}><strong>{course.title}</strong><small style={{ display: 'block', color: 'var(--muted)', marginTop: 4 }}>{progress?.status === 'COMPLETED' ? 'Completed' : progress?.status === 'IN_PROGRESS' ? 'In progress' : 'Not started'} · {percent}%</small><div className="mini-progress" style={{ marginTop: 8 }}><span style={{ width: `${percent}%` }} /></div></div><Link className="secondary-button" href={`/courses/${course.id}`}>{progress?.status === 'COMPLETED' ? 'Review' : percent > 0 ? 'Continue' : 'Start'} <ArrowUpRight size={15} /></Link></div> })}</div>}</section>
    </>}
  </div></AuthShell>
}
