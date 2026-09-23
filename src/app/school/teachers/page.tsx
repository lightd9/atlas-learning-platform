'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, CheckSquare, FileUp, MoreHorizontal, Search, Trash2, Users, Plus, X, RefreshCw, Ban } from 'lucide-react'
import AuthShell from '@/components/AuthShell'
import SetPasswordModal from '@/components/SetPasswordModal'
import { useToast } from '@/components/Toast'

interface TeacherWithInvitation {
  id: string
  name: string
  email: string
  role: string
  status: string
  lastActiveAt: string | null
  averageProgress: number
}

interface InvitationRow {
  id: string
  email: string
  name: string
  status: string
  invitedBy: string
  expiresAt: string
  createdAt: string
}

function formatWhen(dateStr: string | null) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)
  if (diffMin < 60) return `${diffMin} min ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay === 1) return 'Yesterday'
  if (diffDay < 7) return `${diffDay} days ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function TeachersPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [teachers, setTeachers] = useState<TeacherWithInvitation[]>([])
  const [invitations, setInvitations] = useState<InvitationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [inviteSending, setInviteSending] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [deleting, setDeleting] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [acceptTarget, setAcceptTarget] = useState<{ id: string; name: string; email: string } | null>(null)
  const [acceptBusy, setAcceptBusy] = useState(false)
  const [acceptError, setAcceptError] = useState('')

  function loadData() {
    setLoading(true)
    Promise.all([
      fetch('/api/school/teachers').then((r) => r.json()),
      fetch('/api/invitations').then((r) => r.json()),
    ]).then(([tData, iData]) => {
      setTeachers(tData.teachers ?? [])
      setInvitations(iData.invitations ?? [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteError('')
    setInviteSending(true)
    const res = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitations: [{ name: inviteName, email: inviteEmail }] }),
    })
    const data = await res.json()
    setInviteSending(false)
    if (!res.ok) { const message = data.error ?? 'Unable to send invitation'; setInviteError(message); toast(message, 'error'); return }
    setShowInvite(false)
    setInviteName('')
    setInviteEmail('')
    toast('Invitation sent', 'success')
    loadData()
  }

  async function handleResend(id: string) {
    const response = await fetch(`/api/invitations/${id}`, { method: 'POST' })
    toast(response.ok ? 'Invitation resent' : 'Unable to resend invitation', response.ok ? 'success' : 'error')
    loadData()
  }

  async function handleRevoke(id: string) {
    const response = await fetch(`/api/invitations/${id}`, { method: 'DELETE' })
    toast(response.ok ? 'Invitation revoked' : 'Unable to revoke invitation', response.ok ? 'success' : 'error')
    loadData()
  }

  async function acceptInvitation(inv: { id: string; name: string; email: string }, password: string) {
    setAcceptError('')
    setAcceptBusy(true)
    const res = await fetch(`/api/invitations/${inv.id}/accept`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
    setAcceptBusy(false)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setAcceptError(data.error ?? 'Unable to accept invitation'); return }
    setAcceptTarget(null)
    toast('Invitation accepted and account created', 'success')
    loadData()
  }

  function isProtectedMember(m: { type: 'teacher' | 'invitation'; role?: string }) {
    return m.type === 'teacher' && m.role === 'HEADTEACHER'
  }

  async function deleteMembers(userIds: string[], invitationIds: string[]) {
    if (userIds.length === 0 && invitationIds.length === 0) return
    const count = userIds.length + invitationIds.length
    if (!window.confirm(`Delete ${count} selected ${count === 1 ? 'teacher' : 'teachers'}? Active accounts, their course progress and sent invitations are permanently removed.`)) return
    setDeleting(true)
    const res = await fetch('/api/school/teachers/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds, invitationIds }),
    })
    setDeleting(false)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { toast(data.error ?? 'Unable to delete', 'error'); return }
    setSelectedIds([])
    toast('Deleted', 'success')
    loadData()
  }

  function deleteMember(m: { type: 'teacher' | 'invitation'; id: string }) {
    if (m.type === 'teacher') deleteMembers([m.id], [])
    else deleteMembers([], [m.id])
  }

  function deleteSelected() {
    const selectedMembers = filtered.filter((m) => selectedIds.includes(m.id))
    const userIds = selectedMembers.filter((m) => m.type === 'teacher').map((m) => m.id)
    const invitationIds = selectedMembers.filter((m) => m.type === 'invitation').map((m) => m.id)
    deleteMembers(userIds, invitationIds)
  }

  function toggleSelect() { setSelectedIds([]); setSelectMode((v) => !v) }
  function exitSelect() { setSelectedIds([]); setSelectMode(false) }

  const allMembers = [
    ...teachers.map((t) => ({ type: 'teacher' as const, ...t })),
    ...invitations.filter((i) => i.status === 'PENDING' || i.status === 'EXPIRED').map((i) => ({
      type: 'invitation' as const, id: i.id, name: i.name, email: i.email, role: 'TEACHER' as const,
      status: i.status, lastActiveAt: null, averageProgress: 0,
      invitationStatus: i.status,
    })),
  ]

  const filtered = search
    ? allMembers.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase()))
    : allMembers

  const activeCount = teachers.filter((t) => t.status === 'ACTIVE').length
  const pendingCount = invitations.filter((i) => i.status === 'PENDING').length

  return <AuthShell active="Manage teachers">
    <div className="page-wrap">
      <div className="page-heading compact">
        <div>
          <p className="eyebrow">Your school</p>
          <h1>Manage teachers</h1>
          <p className="muted">Invite and manage your school&apos;s learning team.</p>
        </div>
        <button className="primary-button" onClick={() => setShowInvite(!showInvite)}>
          <Plus size={17} /> Add teacher
        </button>
      </div>

      {acceptTarget && <SetPasswordModal
        title="Accept invitation & set password"
        subject={acceptTarget.name}
        subjectLabel={acceptTarget.email}
        description="Create this teacher's account now by choosing the password they will sign in with."
        confirmLabel="Create account & set password"
        busy={acceptBusy}
        error={acceptError}
        onConfirm={(password) => acceptInvitation(acceptTarget, password)}
        onClose={() => { setAcceptTarget(null); setAcceptError('') }}
      />}

      {showInvite && (
        <div className="panel" style={{ marginBottom: 24, maxWidth: 500 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>Invite a teacher</h3>
            <button className="icon-button" onClick={() => setShowInvite(false)}><X size={18} /></button>
          </div>
          <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input placeholder="Full name" value={inviteName} onChange={(e) => setInviteName(e.target.value)} required style={inputStyle} />
            <input placeholder="Email address" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required style={inputStyle} />
            {inviteError && <p style={{ color: '#e53e3e', fontSize: 12, margin: 0 }}>{inviteError}</p>}
            <button type="submit" className="primary-button" disabled={inviteSending} style={{ width: '100%', justifyContent: 'center' }}>
              {inviteSending ? 'Sending...' : 'Send invitation'}
            </button>
          </form>
        </div>
      )}

      <div className="team-actions">
        <div className="upload-card" style={{ cursor: 'pointer' }} onClick={() => router.push('/school/teachers/import')}>
          <div className="upload-icon"><FileUp size={22} /></div>
          <div><h3>Bulk invite teachers</h3><p>Upload a CSV file to invite multiple teachers at once.</p></div>
          <button className="secondary-button">Upload CSV</button>
        </div>
        <div className="team-stat">
          <span>Team members</span>
          <strong>{teachers.length + pendingCount}</strong>
          <small>{activeCount} active · {pendingCount} pending</small>
        </div>
      </div>

      <section className="panel teacher-table">
        <div className="panel-head">
          <div><p className="eyebrow">Your school</p><h3>All teachers</h3></div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="table-search"><Search size={16} /> <input placeholder="Search teachers" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <button className="secondary-button" style={selectMode ? { ...compactSelectStyle, borderColor: '#2b5ea2', color: '#2b5ea2' } : compactSelectStyle} onClick={toggleSelect}><CheckSquare size={14} /> {selectMode ? 'Selecting…' : 'Select'}</button>
        </div>
        <div className="table-wrap">
          {loading
            ? <p className="muted" style={{ padding: 20 }}>Loading teachers...</p>
            : <table>
              <thead><tr>{selectMode && <th style={{ width: 36 }}><input type="checkbox" checked={filtered.some((m) => !isProtectedMember(m)) && selectedIds.length === filtered.filter((m) => !isProtectedMember(m)).length && filtered.length > 0} onChange={(e) => setSelectedIds(e.target.checked ? filtered.filter((m) => !isProtectedMember(m)).map((m) => m.id) : [])} aria-label="Select all teachers" /></th>}<th>Teacher</th><th>Email</th><th>Role</th><th>Status</th><th>Last active</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.length === 0
                  ? <tr><td colSpan={selectMode ? 7 : 6} style={{ textAlign: 'center', padding: 24, color: '#98a2b3' }}>No teachers found</td></tr>
                  : filtered.map((m) => {
                    const roleLabel = m.role === 'HEADTEACHER' ? 'Headteacher' : m.role === 'ATLAS_ADMIN' ? 'Atlas Admin' : 'Teacher'
                    const isInvitation = 'invitationStatus' in m && m.invitationStatus
                    const statusLabel = isInvitation ? (m.invitationStatus === 'EXPIRED' ? 'Expired' : 'Pending invite') : (m.status === 'ACTIVE' ? 'Active' : 'Disabled')
                    const protectedRow = isProtectedMember(m)
                    const initials = m.name.split(' ').map((n: string) => n[0]).join('')
                    return <tr key={m.id}>
                      {selectMode && <td>{protectedRow ? null : <input type="checkbox" checked={selectedIds.includes(m.id)} onChange={(e) => setSelectedIds(e.target.checked ? [...selectedIds, m.id] : selectedIds.filter((id) => id !== m.id))} aria-label={`Select ${m.name}`} />}</td>}
                      <td style={{ whiteSpace: 'nowrap' }}><span className="table-avatar" style={avatarInlineStyle}>{initials}</span><strong>{m.name}</strong></td>
                      <td>{m.email}</td>
                      <td>{roleLabel}</td>
                      <td><span className={`status ${isInvitation ? 'pending' : m.status === 'ACTIVE' ? 'success' : 'error'}`}><i />{statusLabel}</span></td>
                      <td>{isInvitation ? '—' : formatWhen(m.lastActiveAt)}</td>
                      <td>
                        {isInvitation && m.invitationStatus !== 'EXPIRED' && (
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <button className="text-button" onClick={() => setAcceptTarget({ id: m.id, name: m.name, email: m.email })} title="Accept invitation & set password" style={{ color: '#047857' }}><CheckCircle2 size={14} /></button>
                            <button className="text-button" onClick={() => handleResend(m.id)} title="Resend invitation"><RefreshCw size={14} /></button>
                            <button className="text-button" onClick={() => handleRevoke(m.id)} title="Revoke invitation" style={{ color: '#e53e3e' }}><Ban size={14} /></button>
                          </div>
                        )}
                        {isInvitation && m.invitationStatus === 'EXPIRED' && (
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <button className="text-button" onClick={() => setAcceptTarget({ id: m.id, name: m.name, email: m.email })} title="Accept invitation & set password" style={{ color: '#047857' }}><CheckCircle2 size={14} /></button>
                            <button className="text-button" onClick={() => handleResend(m.id)}>Resend</button>
                          </div>
                        )}
                        {!isInvitation && !protectedRow && (
                          <button className="text-button" onClick={() => deleteMember(m)} title="Delete" style={{ ...iconButtonStyle, color: '#e53e3e' }}><Trash2 size={14} /></button>
                        )}
                      </td>
                    </tr>
                  })
                }
              </tbody>
            </table>
          }
        </div>
        {selectMode && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px' }}><button className="secondary-button" style={{ color: '#e53e3e', borderColor: '#feb2b2' }} onClick={deleteSelected} disabled={deleting || selectedIds.length === 0}><Trash2 size={14} /> Delete selected ({selectedIds.length})</button><button className="secondary-button" onClick={exitSelect}>Done</button></div>}
      </section>
    </div>
  </AuthShell>
}

const inputStyle: React.CSSProperties = {
  height: 40, borderRadius: 8, border: '1px solid var(--line)', padding: '0 12px', fontSize: 13, background: '#fff',
}
const iconButtonStyle: React.CSSProperties = { width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', verticalAlign: 'middle', borderRadius: 6 }
const compactSelectStyle: React.CSSProperties = { height: 28, fontSize: 12, padding: '0 10px' }
const avatarInlineStyle: React.CSSProperties = { display: 'inline-grid', verticalAlign: 'middle', marginRight: 10 }
