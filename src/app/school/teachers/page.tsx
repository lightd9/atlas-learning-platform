'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, CheckSquare, FileUp, MoreHorizontal, Search, Trash2, Users, Plus, RefreshCw, Ban } from 'lucide-react'
import AuthShell from '@/components/AuthShell'
import AppModal from '@/components/AppModal'
import SetPasswordModal from '@/components/SetPasswordModal'
import { useToast } from '@/components/Toast'
import ActionMenu from '@/components/ActionMenu'
import BulkResendSummary from '@/components/BulkResendSummary'
import { useInvitationResend } from '@/hooks/useInvitationResend'

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
  const { resend, busy: resendBusy, results: resendResults } = useInvitationResend()

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

  async function handleResend(ids: string[]) {
    const summary = await resend(ids)
    if (!summary) return
    toast(`${summary.sent} invitation${summary.sent === 1 ? '' : 's'} resent`, summary.failed ? 'error' : 'success')
    setSelectedIds((current) => current.filter((id) => !ids.includes(id)))
    loadData()
  }

  async function handleRevoke(id: string) {
    const response = await fetch(`/api/invitations/${id}`, { method: 'PATCH' })
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
  const pendingIds = invitations.filter((i) => i.status === 'PENDING' || i.status === 'EXPIRED').map((i) => i.id)
  const selectedInvitationIds = pendingIds.filter((id) => selectedIds.includes(id))

  return <AuthShell active="Manage teachers">
    <div className="page-wrap">
      <div className="page-heading compact">
        <div>
          <p className="eyebrow">Your school</p>
          <h1>Manage teachers</h1>
          <p className="muted">Invite and manage your school&apos;s learning team.</p>
        </div>
        <button className="primary-button" onClick={() => { setInviteError(''); setShowInvite(true) }}>
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
        <AppModal
          title="Invite a teacher"
          eyebrow="Your school"
          description="Send an invitation so a new teacher can join your school."
          icon={<Users size={18} />}
          width={480}
          dirty={inviteName.trim() !== '' || inviteEmail.trim() !== ''}
          onClose={() => { setShowInvite(false); setInviteName(''); setInviteEmail(''); setInviteError('') }}
          footer={
            <>
              <button className="secondary-button" onClick={() => { setShowInvite(false); setInviteName(''); setInviteEmail(''); setInviteError('') }}>Cancel</button>
              <button className="primary-button" type="submit" form="invite-teacher-form" disabled={inviteSending}>{inviteSending ? 'Sending...' : 'Send invitation'}</button>
            </>
          }
        >
          <form id="invite-teacher-form" onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600 }}>Full name<input placeholder="Full name" value={inviteName} onChange={(e) => setInviteName(e.target.value)} required style={{ ...inputStyle, width: '100%' }} /></label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600 }}>Email address<input placeholder="Email address" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required style={{ ...inputStyle, width: '100%' }} /></label>
            {inviteError && <p style={{ color: '#e53e3e', fontSize: 12, margin: 0 }}>{inviteError}</p>}
          </form>
        </AppModal>
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
        <div className="invitation-resend-toolbar">
          <button className="secondary-button" style={selectMode ? { ...compactSelectStyle, borderColor: '#2b5ea2', color: '#2b5ea2' } : compactSelectStyle} onClick={toggleSelect} disabled={resendBusy}><CheckSquare size={14} /> {selectMode ? 'Selecting…' : 'Select'}</button>
          <button type="button" className="secondary-button" onClick={() => handleResend(pendingIds)} disabled={resendBusy || loading || pendingIds.length === 0}><RefreshCw size={14} /> Resend all pending ({pendingIds.length})</button>
          {selectMode && <button type="button" className="primary-button" onClick={() => handleResend(selectedInvitationIds)} disabled={resendBusy || selectedInvitationIds.length === 0}>{resendBusy ? 'Sending...' : `Resend selected (${selectedInvitationIds.length})`}</button>}
        </div>
        <BulkResendSummary results={resendResults} busy={resendBusy} />
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
                        {isInvitation && <ActionMenu label={`Actions for invitation to ${m.name}`} disabled={resendBusy || acceptBusy || deleting} actions={[
                          { label: 'Accept & set password', icon: <CheckCircle2 size={14} />, onSelect: () => setAcceptTarget({ id: m.id, name: m.name, email: m.email }) },
                          { label: 'Resend invitation', icon: <RefreshCw size={14} />, onSelect: () => handleResend([m.id]) },
                          { label: 'Revoke invitation', icon: <Ban size={14} />, onSelect: () => handleRevoke(m.id), destructive: true },
                        ]} />}
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
