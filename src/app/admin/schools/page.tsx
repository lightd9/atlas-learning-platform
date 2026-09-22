'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Building2, Plus, Search } from 'lucide-react'
import AdminShell from '@/components/AdminShell'
import SetupLinkCard from '@/components/SetupLinkCard'
import { useToast } from '@/components/Toast'
import type { AdminSchool } from '@/types/api'

export default function AdminSchoolsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [schools, setSchools] = useState<AdminSchool[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', slug: '', headteacherEmail: '', headteacherName: '' })
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [setup, setSetup] = useState<{ invitationId?: string; url: string; expiresAt?: string } | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated' && session?.user?.role !== 'ATLAS_ADMIN' && !(session?.user?.role === 'ATLAS_EMPLOYEE' && Array.isArray(session.user.permissions) && (session.user.permissions as string[]).includes('SCHOOL_CREATE'))) { router.push('/dashboard'); return }
    if (status === 'authenticated') {
      fetch('/api/admin/schools').then((r) => r.json()).then((d) => { setSchools(d.schools ?? []); setLoading(false) }).catch(() => setLoading(false))
    }
  }, [status, session, router])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSetup(null)
    const res = await fetch('/api/admin/schools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { const message = data.error ?? 'Unable to create school'; setError(message); toast(message, 'error'); return }
    setSchools([data.school, ...schools])
    setSetup(data.setupUrl ? { invitationId: data.invitationId, url: `${window.location.origin}${data.setupUrl}`, expiresAt: data.expiresAt } : null)
    setShowCreate(false)
    setForm({ name: '', slug: '', headteacherEmail: '', headteacherName: '' })
    toast('School created', 'success')
  }

  const filtered = schools.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) || s.slug.toLowerCase().includes(search.toLowerCase())
  )

  return <AdminShell active="schools">
    <div className="page-wrap">
      <div className="page-heading">
        <div><p className="eyebrow">Admin</p><h1>Schools</h1></div>
        <button className="primary-button" onClick={() => setShowCreate(!showCreate)}><Plus size={17} /> Add school</button>
      </div>

      {showCreate && (
        <div className="panel" style={{ marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 16px' }}>Create new school</h3>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 500 }}>
            <input placeholder="School name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required style={inputStyle} />
            <input placeholder="Slug (e.g. st-marys)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required style={inputStyle} />
            <input placeholder="Headteacher email (optional)" value={form.headteacherEmail} onChange={(e) => setForm({ ...form, headteacherEmail: e.target.value })} style={inputStyle} />
            <input placeholder="Headteacher name (optional)" value={form.headteacherName} onChange={(e) => setForm({ ...form, headteacherName: e.target.value })} style={inputStyle} />
            {error && <p style={{ color: '#e53e3e', margin: 0, fontSize: 13 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="primary-button">Create school</button>
              <button type="button" className="secondary-button" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
            {setup && <SetupLinkCard label="Headteacher setup link" setupUrl={setup.url} invitationId={setup.invitationId} expiresAt={setup.expiresAt} />}
          </form>
        </div>
      )}

      <div className="top-search" style={{ marginBottom: 20, width: '100%', maxWidth: 360 }}>
        <Search size={17} />
        <input placeholder="Search schools..." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search schools" />
      </div>

      {loading ? <p>Loading...</p> : filtered.length === 0 ? (
        <div className="panel" style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>No schools found.</div>
      ) : (
        <div className="panel table-wrap" style={{ padding: 0 }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>School</th>
                <th>Slug</th>
                <th>Users</th>
                <th>Courses</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((school) => (
                <tr key={school.id} className="school-row" role="link" onClick={() => router.push(`/admin/schools/${school.id}`)} tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); router.push(`/admin/schools/${school.id}`) } }} aria-label={`View ${school.name} profile`}>
                  <td><strong>{school.name}</strong></td>
                  <td style={{ color: 'var(--muted)' }}>{school.slug}</td>
                  <td>{school.userCount}</td>
                  <td>{school.courseCount}</td>
                  <td><span className={`badge ${school.active ? 'badge-active' : 'badge-inactive'}`}>{school.active ? 'Active' : 'Disabled'}</span></td>
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
