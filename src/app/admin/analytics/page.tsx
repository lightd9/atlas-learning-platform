'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Download } from 'lucide-react'
import AdminShell from '@/components/AdminShell'
import Metric from '@/components/Metric'

export default function AdminAnalyticsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [schoolSearch, setSchoolSearch] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated' && session?.user?.role !== 'ATLAS_ADMIN') { router.push('/dashboard'); return }
    if (status === 'authenticated') {
      fetch('/api/admin/analytics').then((r) => r.json()).then((d) => { setData(d); setLoading(false) }).catch(() => setLoading(false))
    }
  }, [status, session, router])

  const tones = ['blue', 'mint', 'lilac', 'peach', 'violet'] as const
  const filteredSchools = data?.schoolBreakdown?.filter((school: any) => school.schoolName.toLowerCase().includes(schoolSearch.toLowerCase())) ?? []
  function exportCsv() {
    const rows = [['School', 'Teachers', 'Completions', 'Average progress'], ...filteredSchools.map((school: any) => [school.schoolName, school.teacherCount, school.completionCount, `${school.avgProgress}%`])]
    const blob = new Blob([rows.map((row) => row.join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'atlas-school-analytics.csv'; link.click(); URL.revokeObjectURL(url)
  }

  if (loading) return <AdminShell active="analytics"><div className="page-wrap"><p>Loading...</p></div></AdminShell>
  if (!data) return null

  return <AdminShell active="analytics">
    <div className="page-wrap">
      <div className="page-heading">
        <div><p className="eyebrow">Atlas Admin workspace</p><h1>Platform analytics</h1><p className="muted">Compare learning activity and course engagement across every school.</p></div>
      </div>

      <div className="metric-grid admin-mobile-two-column" style={{ marginBottom: 32 }}>
        <Metric iconClass="metric-icon-img" icon={<img src="/school-icon.png" alt="" className="metric-img" />} label="Active schools" value={String(data.totalSchools)} sublabel={`${data.totalHeadteachers} headteachers`} />
        <Metric iconClass="metric-icon-img" icon={<img src="/person-icon.png" alt="" className="metric-img" />} label="Teachers" value={String(data.totalTeachers)} sublabel={`${data.activeInvitations} pending invites`} />
        <Metric iconClass="metric-icon-img" icon={<img src="/course-icon.png" alt="" className="metric-img" />} label="Courses" value={String(data.totalCourses)} sublabel="Platform-wide" />
        <Metric iconClass="metric-icon-img" icon={<img src="/pending-icon.png" alt="" className="metric-img" />} label="Completions" value={String(data.totalCompletions)} sublabel={`${Math.round(data.totalLearningMinutes / 60)}h total`} />
      </div>

      <div className="section-head">
        <div><p className="eyebrow">Insights</p><h2>School performance</h2></div><div style={{ display: 'flex', gap: 8 }}><input value={schoolSearch} onChange={(e) => setSchoolSearch(e.target.value)} placeholder="Filter schools" aria-label="Filter schools" style={inputStyle} /><button className="secondary-button" onClick={exportCsv}><Download size={16} /> Export CSV</button></div>
      </div>

      {data.schoolBreakdown?.length > 0 ? (
        <div className="panel table-wrap" style={{ padding: 0 }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>School</th>
                <th>Teachers</th>
                <th>Completions</th>
                <th>Avg progress</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              {filteredSchools.map((s: any, i: number) => (
                <tr key={i} onClick={() => router.push(`/school/analytics?schoolId=${encodeURIComponent(s.schoolId)}`)} style={{ cursor: 'pointer' }} aria-label={`View ${s.schoolName} analytics`}>
                  <td><strong>{s.schoolName}</strong></td>
                  <td>{s.teacherCount}</td>
                  <td>{s.completionCount}</td>
                  <td>{s.avgProgress}%</td>
                  <td style={{ width: 120 }}>
                    <div className="mini-progress">
                      <span style={{ width: `${s.avgProgress}%`, background: `var(--${tones[i % tones.length]})` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="panel" style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
          No data yet. Schools need to be active with teacher progress.
        </div>
      )}
    </div>
  </AdminShell>
}

const inputStyle: React.CSSProperties = { height: 40, borderRadius: 8, border: '1px solid var(--line)', padding: '0 12px', fontSize: 13, background: '#00000' }
