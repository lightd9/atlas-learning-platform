'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Mail, UsersRound, RefreshCw, Trash2, CheckCircle2 } from 'lucide-react'
import AdminShell from '@/components/AdminShell'
import SetupLinkCard from '@/components/SetupLinkCard'
import SetPasswordModal from '@/components/SetPasswordModal'
import { useToast } from '@/components/Toast'

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

export default function AdminInvitationsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [invitations, setInvitations] = useState<AdminInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [resendLink, setResendLink] = useState<{ invitationId?: string; url: string; expiresAt?: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [acceptTarget, setAcceptTarget] = useState<AdminInvitation | null>(null)
  const [acceptBusy, setAcceptBusy] = useState(false)
  const [acceptError, setAcceptError] = useState('')

  async function load() {
    const res = await fetch('/api/admin/invitations')
    if (!res.ok) { toast('Unable to load invitations', 'error'); return }
    const data = await res.json()
    setInvitations(data.invitations ?? [])
    setLoading(false)
  }

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated' && session?.user?.role !== 'ATLAS_ADMIN') { router.push('/dashboard'); return }
    if (status === 'authenticated') load()
  }, [status, session, router])

  async function resendInvitation(inv: AdminInvitation) {
    if (busy) return
    setBusy(true)
    const res = await fetch(`/api/invitations/${inv.id}`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok || !data.invitation?.setupToken) { toast(data.error ?? 'Unable to send a new link', 'error'); return }
    setResendLink({ invitationId: inv.id, url: `${window.location.origin}/setup/${data.invitation.setupToken}`, expiresAt: data.invitation.expiresAt })
    toast('New link sent', 'success')
    load()
  }

  async function deleteInvitation(inv: AdminInvitation) {
    if (!window.confirm(`Delete the invitation for ${inv.name} (${inv.email})? The invitee will no longer be able to set up an account.`)) return
    const res = await fetch(`/api/invitations/${inv.id}`, { method: 'DELETE' })
    if (res.ok) {
      setInvitations(invitations.filter((item) => item.id !== inv.id))
      toast('Invitation deleted', 'success')
    } else toast('Unable to delete invitation', 'error')
  }

  async function acceptInvitation(inv: AdminInvitation, password: string) {
    setAcceptError('')
    setAcceptBusy(true)
    const res = await fetch(`/api/invitations/${inv.id}/accept`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setAcceptBusy(false); setAcceptError(data.error ?? 'Unable to accept invitation'); return }
    setAcceptBusy(false)
    setAcceptTarget(null)
    setInvitations(invitations.filter((item) => item.id !== inv.id))
    toast('Invitation accepted and account created', 'success')
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
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="secondary-button" onClick={() => router.push('/admin/users')}><UsersRound size={16} /> Back to users</button>
          <button className="secondary-button" onClick={load}><RefreshCw size={16} /> Refresh</button>
        </div>
      </div>

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
        {resendLink && <div style={{ padding: 12, borderBottom: '1px solid var(--line)' }}><SetupLinkCard label="New setup link sent" setupUrl={resendLink.url} invitationId={resendLink.invitationId} expiresAt={resendLink.expiresAt} /></div>}
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
                    <td><strong>{inv.name}</strong></td>
                    <td style={{ color: 'var(--muted)' }}>{inv.email}</td>
                    <td><span className={`badge ${roleBadge(inv.role)}`}>{formatRole(inv.role)}</span></td>
                    <td>{inv.schoolName || '—'}</td>
                    <td>{inv.invitedBy}</td>
                    <td><span className={`badge ${invitationStatusBadge(inv.status)}`}>{inv.status}</span></td>
                    <td>{inv.status === 'REVOKED' ? '—' : new Date(inv.expiresAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                    <td>
                      <span style={{ display: 'inline-flex', gap: 5 }} aria-label={`Actions for invitation to ${inv.name}`}>
                        <button className="icon-button" title="Accept & set password" aria-label={`Accept invitation and set password for ${inv.name}`} onClick={() => handleInvitationAction(inv, 'accept')}><CheckCircle2 size={16} style={{ color: '#047857' }} /></button>
                        <button className="icon-button" title="Resend invitation" aria-label={`Resend invitation to ${inv.name}`} onClick={() => handleInvitationAction(inv, 'resend')}><RefreshCw size={16} /></button>
                        {inv.status !== 'REVOKED' && <button className="icon-button" title="Delete invitation" aria-label={`Delete invitation for ${inv.name}`} onClick={() => handleInvitationAction(inv, 'delete')}><Trash2 size={16} style={{ color: '#b42318' }} /></button>}
                      </span>
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
