'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Mail, UsersRound, RefreshCw, Trash2, CheckCircle2 } from 'lucide-react'
import AdminShell from '@/components/AdminShell'
import SetupLinkCard from '@/components/SetupLinkCard'
import SetPasswordModal from '@/components/SetPasswordModal'
import { useToast } from '@/components/Toast'
import ActionMenu from '@/components/ActionMenu'
import BulkResendSummary from '@/components/BulkResendSummary'
import { useInvitationResend } from '@/hooks/useInvitationResend'

interface AdminInvitation {
  id: string
  name: string
  email: string
  role: string
  status: 'PENDING' | 'EXPIRED' | 'REVOKED'
  schoolName: string | null
  invitedBy: string
  expiresAt: string
  createdAt: string
}

type SetupLink = { invitationId?: string; email?: string; url: string; expiresAt?: string }

export default function AdminInvitationsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [invitations, setInvitations] = useState<AdminInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [resendLinks, setResendLinks] = useState<SetupLink[]>([])
  const [busy, setBusy] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const { resend: bulkResend, busy: bulkBusy, results: bulkResults } = useInvitationResend()
  const [acceptTarget, setAcceptTarget] = useState<AdminInvitation | null>(null)
  const [acceptBusy, setAcceptBusy] = useState(false)
  const [acceptError, setAcceptError] = useState('')

  async function load() {
    try {
      const res = await fetch('/api/admin/invitations')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Unable to load invitations')
      setInvitations(data.invitations ?? [])
      setSelectedIds((current) => current.filter((id) => data.invitations.some((inv: AdminInvitation) => inv.id === id)))
    } catch (error) { toast(error instanceof Error ? error.message : 'Unable to load invitations', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated' && session?.user?.role !== 'ATLAS_ADMIN') { router.push('/dashboard'); return }
    if (status === 'authenticated') load()
  }, [status, session, router])

  const resendableInvitations = invitations.filter((inv) => inv.status === 'PENDING' || inv.status === 'EXPIRED')
  const allSelected = resendableInvitations.length > 0 && resendableInvitations.every((inv) => selectedIds.includes(inv.id))

  function toggleSelection(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  function toggleSelectAll() {
    setSelectedIds(allSelected ? [] : resendableInvitations.map((inv) => inv.id))
  }

  async function resendSelected(ids = selectedIds) {
    if (busy) return
    const summary = await bulkResend(ids)
    if (!summary) return
    toast(`${summary.sent} link${summary.sent === 1 ? '' : 's'} sent`, summary.failed ? 'error' : 'success')
    setSelectedIds([])
    load()
  }

  async function resendInvitation(inv: AdminInvitation) {
    if (busy || bulkBusy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/invitations/${inv.id}`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.invitation?.setupToken) throw new Error(data.error ?? 'Unable to send a new link')
      setResendLinks((current) => [{ invitationId: inv.id, email: inv.email, url: `${window.location.origin}/setup/${data.invitation.setupToken}`, expiresAt: data.invitation.expiresAt }, ...current.filter((link) => link.invitationId !== inv.id)])
      toast('New link sent', 'success')
      await load()
    } catch (error) { toast(error instanceof Error ? error.message : 'Unable to send a new link', 'error') }
    finally { setBusy(false) }
  }

  async function deleteInvitation(inv: AdminInvitation) {
    if (busy || bulkBusy || acceptBusy) return
    if (!window.confirm(`Delete the invitation for ${inv.name} (${inv.email})? The invitee will no longer be able to set up an account.`)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/invitations/${inv.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Unable to delete invitation')
      setInvitations((current) => current.filter((item) => item.id !== inv.id))
      setSelectedIds((current) => current.filter((id) => id !== inv.id))
      setResendLinks((current) => current.filter((link) => link.invitationId !== inv.id))
      toast('Invitation deleted', 'success')
    } catch (error) { toast(error instanceof Error ? error.message : 'Unable to delete invitation', 'error') }
    finally { setBusy(false) }
  }

  async function acceptInvitation(inv: AdminInvitation, password: string) {
    setAcceptError('')
    setAcceptBusy(true)
    try {
      const res = await fetch(`/api/invitations/${inv.id}/accept`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Unable to accept invitation')
      setAcceptTarget(null)
      setInvitations((current) => current.filter((item) => item.id !== inv.id))
      setSelectedIds((current) => current.filter((id) => id !== inv.id))
      setResendLinks((current) => current.filter((link) => link.invitationId !== inv.id))
      toast('Invitation accepted and account created', 'success')
    } catch (error) { setAcceptError(error instanceof Error ? error.message : 'Unable to accept invitation') }
    finally { setAcceptBusy(false) }
  }

  function handleInvitationAction(inv: AdminInvitation, action: string) {
    if (action === 'resend') resendInvitation(inv)
    if (action === 'delete') deleteInvitation(inv)
    if (action === 'accept') setAcceptTarget(inv)
  }

  return <AdminShell active="users">
    <div className="page-wrap">
      <div className="page-heading">
        <div><p className="eyebrow">Platform administration</p><h1>Pending invitations</h1><p className="muted">Invited users who have not yet set up their account.</p></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="secondary-button" onClick={() => router.push('/admin/users')}><UsersRound size={16} /> Back to users</button>
          <button className="secondary-button" onClick={load}><RefreshCw size={16} /> Refresh</button>
        </div>
      </div>

      <div className="invitation-resend-toolbar">
        <button type="button" className="secondary-button" onClick={toggleSelectAll} disabled={busy || bulkBusy || resendableInvitations.length === 0}>
          {allSelected ? 'Deselect all' : 'Select all resendable'}
        </button>
        <span className="muted" style={{ fontSize: 13 }}>{selectedIds.length} selected</span>
        <button type="button" className="secondary-button" onClick={() => resendSelected(resendableInvitations.map((inv) => inv.id))} disabled={busy || bulkBusy || resendableInvitations.length === 0}><RefreshCw size={16} /> Resend all pending ({resendableInvitations.length})</button>
        <button type="button" className="primary-button" onClick={() => resendSelected()} disabled={busy || bulkBusy || selectedIds.length === 0}><Mail size={16} /> {bulkBusy ? 'Sending...' : `Resend selected (${selectedIds.length})`}</button>
      </div>

      <BulkResendSummary results={bulkResults} busy={bulkBusy} />

      {resendLinks.length > 0 && (
        <div style={{ display: 'grid', gap: 10, marginBottom: 12 }}>
          {resendLinks.map((link) => (
            <SetupLinkCard
              key={link.invitationId ?? link.url}
              label={`New setup link sent${link.email ? ` to ${link.email}` : ''}`}
              setupUrl={link.url}
              invitationId={link.invitationId}
              expiresAt={link.expiresAt}
            />
          ))}
        </div>
      )}

      <div className="panel" style={{ overflow: 'hidden', padding: 0 }}>
        {acceptTarget && <SetPasswordModal
          title="Accept invitation & set password"
          subject={acceptTarget.name}
          subjectLabel={acceptTarget.email}
          description="Create this user's account now by choosing the password they will sign in with."
          confirmLabel="Create account & set password"
          busy={acceptBusy}
          error={acceptError}
          onConfirm={(password) => acceptInvitation(acceptTarget, password)}
          onClose={() => { setAcceptTarget(null); setAcceptError('') }}
        />}
        {loading ? <p style={{ padding: 16, margin: 0 }}>Loading...</p> : invitations.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <Mail size={28} color="var(--blue)" style={{ marginBottom: 10 }} />
            <h3>No pending invitations</h3>
            <p className="muted" style={{ margin: 0 }}>Everyone invited to Atlas has responded.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th><span className="sr-only">Select</span></th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>School</th>
                  <th>Invited by</th>
                  <th>Status</th>
                  <th>Expires</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((inv) => (
                  <tr key={inv.id}>
                    <td>{(inv.status === 'PENDING' || inv.status === 'EXPIRED') && (
                      <input
                        type="checkbox"
                        aria-label={`Select invitation for ${inv.name}`}
                        checked={selectedIds.includes(inv.id)}
                        disabled={busy || bulkBusy || acceptBusy}
                        onChange={() => toggleSelection(inv.id)}
                      />
                    )}</td>
                    <td><strong>{inv.name}</strong></td>
                    <td style={{ color: 'var(--muted)' }}>{inv.email}</td>
                    <td><span className={`badge ${roleBadge(inv.role)}`}>{formatRole(inv.role)}</span></td>
                    <td>{inv.schoolName || '—'}</td>
                    <td>{inv.invitedBy}</td>
                    <td><span className={`badge ${invitationStatusBadge(inv.status)}`}>{inv.status}</span></td>
                    <td>{inv.status === 'REVOKED' ? '—' : new Date(inv.expiresAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                    <td>
                      <ActionMenu label={`Actions for invitation to ${inv.name}`} disabled={busy || bulkBusy || acceptBusy} actions={[
                        { label: 'Accept & set password', icon: <CheckCircle2 size={16} />, onSelect: () => handleInvitationAction(inv, 'accept'), disabled: inv.status === 'REVOKED' },
                        { label: 'Resend invitation', icon: <RefreshCw size={16} />, onSelect: () => handleInvitationAction(inv, 'resend'), disabled: inv.status === 'REVOKED' },
                        { label: 'Delete invitation', icon: <Trash2 size={16} />, onSelect: () => handleInvitationAction(inv, 'delete'), destructive: true },
                      ]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  </AdminShell>
}

function formatRole(role: string) {
  switch (role) {
    case 'ATLAS_ADMIN': return 'Atlas Admin'
    case 'INSTRUCTOR': return 'Instructor'
    case 'HEADTEACHER': return 'Headteacher'
    case 'TEACHER': return 'Teacher'
    default: return role
  }
}

function roleBadge(role: string) {
  switch (role) {
    case 'ATLAS_ADMIN': return 'badge-admin'
    case 'INSTRUCTOR': return 'badge-headteacher'
    case 'HEADTEACHER': return 'badge-headteacher'
    default: return 'badge-teacher'
  }
}

function invitationStatusBadge(status: string) {
  switch (status) {
    case 'PENDING': return 'badge-pending'
    case 'EXPIRED':
    case 'REVOKED': return 'badge-inactive'
    default: return ''
  }
}

const selectStyle: React.CSSProperties = {
  height: 40, borderRadius: 8, border: '1px solid var(--line)', padding: '0 12px', fontSize: 13, background: '#fff', minWidth: 140,
}
