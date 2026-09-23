'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Building2, Plus, School as SchoolIcon, Search } from 'lucide-react'
import AdminShell from '@/components/AdminShell'
import AppModal from '@/components/AppModal'
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

  const createDirty =
    form.name.trim() !== '' || form.slug.trim() !== '' || form.headteacherEmail.trim() !== '' || form.headteacherName.trim() !== ''

  const filtered = schools.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) || s.slug.toLowerCase().includes(search.toLowerCase())
  )

  return <AdminShell active="schools">
    <div className="page-wrap">
      <div className="page-heading">
        <div><p className="eyebrow">Admin</p><h1>Schools</h1></div>
        <button className="primary-button" onClick={() => { setError(''); setSetup(null); setShowCreate(true) }}><Plus size={17} /> Add school</button>
      </div>

      {setup && <div style={{ marginBottom: 20, maxWidth: 360 }}><SetupLinkCard label="Headteacher setup link" setupUrl={setup.url} invitationId={setup.invitationId} expiresAt={setup.expiresAt} /></div>}

      {showCreate && (
        <AppModal
          title="Add school"
          eyebrow="Admin"
          description="Create a new school and optionally invite its headteacher."
          icon={<SchoolIcon size={18} />}
          width={520}
          dirty={createDirty}
          onClose={() => { setShowCreate(false); setForm({ name: '', slug: '', headteacherEmail: '', headteacherName: '' }); setError('') }}
          footer={
            <>
              <button className="secondary-button" onClick={() => { setShowCreate(false); setForm({ name: '', slug: '', headteacherEmail: '', headteacherName: '' }); setError('') }}>Cancel</button>
              <button className="primary-button" type="submit" form="create-school-form">Create school</button>
            </>
          }
        >
          <form id="create-school-form" onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={labelStyle}>School name<input placeholder="e.g. St Mary's Academy" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required style={inputStyle} /></label>
            <label style={labelStyle}>Slug<input placeholder="e.g. st-marys" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required style={inputStyle} /></label>
            <label style={labelStyle}>Headteacher email (optional)<input placeholder="headteacher@school.com" type="email" value={form.headteacherEmail} onChange={(e) => setForm({ ...form, headteacherEmail: e.target.value })} style={inputStyle} /></label>
            <label style={labelStyle}>Headteacher name (optional)<input placeholder="Full name" value={form.headteacherName} onChange={(e) => setForm({ ...form, headteacherName: e.target.value })} style={inputStyle} /></label>
            {error && <p style={{ color: '#e53e3e', margin: 0, fontSize: 13 }}>{error}</p>}
          </form>
        </AppModal>
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
  height: 40, borderRadius: 8, border: '1px solid var(--line)', padding: '0 12px', fontSize: 13, background: '#fff', width: '100%', marginTop: 4,
}

const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#374151', display: 'flex', flexDirection: 'column', gap: 0 }
