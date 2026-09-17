'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { FileUp } from 'lucide-react'
import AuthShell from '@/components/AuthShell'
import Metric from '@/components/Metric'
import type { ApiAnalytics } from '@/types/api'

const toneColors: Record<string, string> = {
  blue: '#2B5EA2',
  mint: '#7acdb8',
  lilac: '#c2a4ee',
  peach: '#f8a8a1',
  violet: '#a78bfa',
  gray: '#edf0f6',
}

function formatMinutes(mins: number) {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function buildChartPath(series: { minutes: number }[]) {
  if (series.length === 0) return { line: '', area: '', coords: [] }

  const width = 620
  const height = 210
  const padTop = 8
  const padBottom = 10
  const max = Math.max(...series.map((s) => s.minutes), 1)
  const step = series.length > 1 ? width / (series.length - 1) : 0
  const coords = series.map((s, i) => ({
    x: Math.round(i * step),
    y: Math.round(height - padBottom - (s.minutes / max) * (height - padTop - padBottom)),
  }))
  let path = `M${coords[0].x} ${coords[0].y}`
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1]
    const mid = { x: Math.round((prev.x + coords[i].x) / 2), y: Math.round((prev.y + coords[i].y) / 2) }
    path += ` Q${prev.x} ${prev.y} ${mid.x} ${mid.y} T${coords[i].x} ${coords[i].y}`
  }
  const area = `${path} V210 H0 Z`
  return { line: path, area, coords }
}

export default function AnalyticsPage() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const selectedSchoolId = searchParams.get('schoolId')
  const [analytics, setAnalytics] = useState<ApiAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [hover, setHover] = useState<number | null>(null)
  const [activityDays, setActivityDays] = useState<7 | 14 | 30>(30)

  useEffect(() => {
    fetch(`/api/school/analytics${selectedSchoolId ? `?schoolId=${encodeURIComponent(selectedSchoolId)}` : ''}`).then((r) => {
      if (!r.ok) throw new Error('API error')
      return r.json()
    }).then((d) => { setAnalytics(d); setLoading(false) }).catch(() => setLoading(false))
  }, [selectedSchoolId])

  const schoolName = selectedSchoolId ? 'Selected school' : session?.user?.schoolId ? 'Your school' : 'Atlas Learning'

  const chart = useMemo(() => {
    const activity = analytics?.learningActivity ?? []
    const series = activity.slice(-activityDays)
    return { series, ...buildChartPath(series) }
  }, [analytics, activityDays])

  const donutBackground = useMemo(() => {
    if (!analytics?.courseBreakdown?.length) return 'conic-gradient(#edf0f6 0 100%)'
    let cursor = 0
    const stops = analytics.courseBreakdown.map((cb) => {
      const from = cursor
      cursor += cb.percent
      return `${toneColors[cb.tone] || '#2B5EA2'} ${from}% ${Math.min(cursor, 100)}%`
    })
    return `conic-gradient(${stops.join(', ')})`
  }, [analytics])

  return <AuthShell active="School analytics">
    <div className="page-wrap">
      <div className="page-heading compact">
        <div>
          <p className="eyebrow">{schoolName} Â· Headteacher view</p>
          <h1>School analytics</h1>
          <p className="muted">A clear view of how your team is learning.</p>
        </div>
        <button className="secondary-button"><FileUp size={17} /> Export report</button>
      </div>

      {loading
        ? <div className="metric-grid admin-mobile-two-column">{[0, 1, 2, 3].map((i) => <div key={i} className="metric-card" style={{ height: 90, opacity: 0.4 }} />)}</div>
        : analytics && <>
<div className="metric-grid school-analytics-metrics admin-mobile-two-column">
<Metric iconClass="metric-icon-img" icon={<img src="/person-icons.png" alt="" className="metric-img" />} label="Active teachers" value={String(analytics.activeTeachers)} change={analytics.pendingTeachers > 0 ? `${analytics.pendingTeachers} pending` : 'All active'} />
            <Metric iconClass="metric-icon-img" icon={<img src="/metric-complete.png" alt="" className="metric-img" />} label="Courses completed" value={String(analytics.coursesCompleted)} change="Total completions" />
            <Metric iconClass="metric-icon-img" icon={<img src="/metric-pending.png" alt="" className="metric-img" />} label="Learning time" value={formatMinutes(analytics.totalLearningMinutes)} change="All teachers combined" />
            <Metric iconClass="metric-icon-img" icon={<img src="/metric-progress.png" alt="" className="metric-img" />} label="Average progress" value={`${analytics.averageProgress}%`} change="Across all courses" />
          </div>

          <div className="analytics-grid">
            <section className="panel large-chart">
              <div className="panel-head">
                <div><p className="eyebrow">Engagement over time</p><h3>Learning activity</h3></div>
                <label>
                  <select
                    className="period-select"
                    value={activityDays}
                    onChange={(event) => {
                      setActivityDays(Number(event.target.value) as 7 | 14 | 30)
                      setHover(null)
                    }}
                    aria-label="Learning activity date range"
                  >
                    <option value={7}>Last 7 days</option>
                    <option value={14}>Last 14 days</option>
                    <option value={30}>Last 30 days</option>
                  </select>
                </label>
              </div>
              <div className="chart">
                <div className="chart-y"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0</span></div>
                <div className="chart-area" onMouseLeave={() => setHover(null)}>
                  <div className="grid-lines" />
                  {chart.series.length > 1 ? <>
                    <svg viewBox="0 0 620 210" preserveAspectRatio="none" aria-label="Learning activity trend">
                      <defs>
                        <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2B5EA2" stopOpacity=".22" />
                          <stop offset="100%" stopColor="#2B5EA2" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path d={chart.area} fill="url(#fill)" />
                      <path d={chart.line} fill="none" stroke="#2B5EA2" strokeWidth="3" />
                      {chart.coords.map((c, i) => (
                        <circle
                          key={i}
                          cx={c.x}
                          cy={c.y}
                          r={hover === i ? 6 : 3.5}
                          fill="#00000"
                          stroke="#2B5EA2"
                          strokeWidth={2}
                          onMouseEnter={() => setHover(i)}
                        />
                      ))}
                    </svg>
                    {hover !== null && chart.series[hover] && (
                      <div className="chart-tooltip" style={{ left: `${(chart.coords[hover].x / 620) * 100}%`, top: `${(chart.coords[hover].y / 210) * 100}%` }}>
                        <strong>{chart.series[hover].minutes}m</strong>
                        <span>{chart.series[hover].label}</span>
                      </div>
                    )}
                  </> : <p className="muted" style={{ padding: 20 }}>No learning activity recorded yet.</p>}
                  <div className="chart-x">
                    {chart.series.length > 0 && chart.series
                      .filter((_, i) => i % 7 === 0 || i === chart.series.length - 1)
                      .map((point, i, arr) => <span key={i}>{arr.length > 1 && i < arr.length - 1 ? point.label : chart.series[chart.series.length - 1].label}</span>)}
                  </div>
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <div><p className="eyebrow">Course breakdown</p><h3>Completion by course</h3></div>
              </div>
              <div className="donut" style={{ background: donutBackground }} role="img" aria-label="Completion by course donut chart">
                <span className="donut-total"><strong>{analytics.coursesCompleted}</strong><small>completed</small></span>
              </div>
              <div className="legend">
                {analytics.courseBreakdown.map((cb) => (
                  <div className="legend-item" key={cb.title}>
                    <span className={`dot ${cb.tone}-dot`} />
                    <span className="legend-label">{cb.title}</span>
                    <b>{cb.percent}%</b>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {analytics.teacherActivity.length > 0 && <section className="panel" style={{ marginTop: 24 }}>
            <div className="panel-head">
              <div><p className="eyebrow">Individual progress</p><h3>Teacher activity</h3></div>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Teacher</th><th>Progress</th><th>Status</th><th>Last active</th><th /></tr></thead>
                <tbody>
                  {analytics.teacherActivity.map((t) => (
                    <tr key={t.name}>
                      <td><span className="table-avatar">{t.initials}</span><strong>{t.name}</strong></td>
                      <td>{t.progress}</td>
                      <td><span className={`status ${t.status === 'Active' ? 'success' : 'pending'}`}><i />{t.status}</span></td>
                      <td>{t.lastActive}</td>
                      <td />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>}
        </>
      }
    </div>
  </AuthShell>
}
