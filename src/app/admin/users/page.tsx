'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Users, Search, Plus, X, Mail } from 'lucide-react'
import AdminShell from '@/components/AdminShell'
import SetupLinkCard from '@/components/SetupLinkCard'
import { useToast } from '@/components/Toast'
import type { AdminUser } from '@/types/api'

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

export default function AdminUsersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', email: '', role: 'INSTRUCTOR', schoolId: '' })
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([])
  const [createError, setCreateError] = useState('')
  const [setup, setSetup] = useState<{ invitationId?: string; url: string; expiresAt?: string } | null>(null)
  const [invitations, setInvitations] = useState<AdminInvitation[]>([])
  const [invitationsLoading, setInvitationsLoading] = useState(true)
  const [resendLink, setResendLink] = useState<{ invitationId?: string; url: string; expiresAt?: string } | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated' && session?.user?.role !== 'ATLAS_ADMIN') { router.push('/dashboard'); return }
    if (status === 'authenticated') {
      Promise.all([fetch('/api/admin/users').then((r) => r.json()), fetch('/api/admin/schools').then((r) => r.json()), fetch('/api/admin/invitations').then((r) => r.json())]).then(([d, s, i]) => { setUsers(d.users ?? []); setSchools((s.schools ?? []).map((school: any) => ({ id: school.id, name: school.name }))); setInvitations(i.invitations ?? []); setLoading(false); setInvitationsLoading(false) }).catch(() => { setLoading(false); setInvitationsLoading(false) })
    }
  }, [status, session, router])

  async function createUser(e: React.FormEvent) {
    e.preventDefault(); setCreateError(''); setSetup(null)
    const res = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(createForm) })
    const data = await res.json()
    if (!res.ok) { const message = data.error ?? 'Unable to create user'; setCreateError(message); toast(message, 'error'); return }
    setSetup({ invitationId: data.invitation?.id, url: `${window.location.origin}${data.setupUrl}`, expiresAt: data.invitation?.expiresAt })
    setCreateForm({ name: '', email: '', role: 'INSTRUCTOR', schoolId: '' })
    fetch('/api/admin/users').then((r) => r.json()).then((d) => setUsers(d.users ?? []))
    toast('Invitation created', 'success')
  }

  async function toggleUser(user: AdminUser) {
    const nextStatus = user.status === 'DISABLED' ? 'ACTIVE' : 'DISABLED'
    const res = await fetch(`/api/admin/users/${user.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: nextStatus }) })
    if (res.ok) {
      setUsers(users.map((item) => item.id === user.id ? { ...item, status: nextStatus } : item))
      toast(nextStatus === 'ACTIVE' ? 'User enabled' : 'User disabled', 'success')
    } else toast('Unable to update user status', 'error')
  }

  async function deleteUser(user: AdminUser) {
    if (!window.confirm(`Delete ${user.name} (${user.email})? This permanently removes their account, course progress and invitations they sent.`)) return
    const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
    if (res.ok) {
      setUsers(users.filter((item) => item.id !== user.id))
      toast('User deleted', 'success')
    } else {
      const data = await res.json().catch(() => ({}))
      toast(data.error ?? 'Unable to delete user', 'error')
    }
  }

  function handleUserAction(user: AdminUser, action: string) {
    if (action === 'toggle-status') toggleUser(user)
    if (action === 'delete') deleteUser(user)
  }

  async function refreshInvitations() {
    const res = await fetch('/api/admin/invitations')
    if (res.ok) { const data = await res.json(); setInvitations(data.invitations ?? []) }
  }

  async function resendInvitation(inv: AdminInvitation) {
    const res = await fetch(`/api/invitations/${inv.id}`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.invitation?.setupToken) { toast(data.error ?? 'Unable to send a new link', 'error'); return }
    setResendLink({ invitationId: inv.id, url: `${window.location.origin}/setup/${data.invitation.setupToken}`, expiresAt: data.invitation.expiresAt })
    toast('New link sent', 'success')
    refreshInvitations()
  }

  async function revokeInvitation(inv: AdminInvitation) {
    if (!window.confirm(`Revoke the invitation for ${inv.name} (${inv.email})? The invitee will no longer be able to set up an account.`)) return
    const res = await fetch(`/api/invitations/${inv.id}`, { method: 'DELETE' })
    if (res.ok) {
      setInvitations(invitations.filter((item) => item.id !== inv.id))
      toast('Invitation revoked', 'success')
    } else toast('Unable to revoke invitation', 'error')
  }

  function handleInvitationAction(inv: AdminInvitation, action: string) {
    if (action === 'resend') resendInvitation(inv)
    if (action === 'revoke') revokeInvitation(inv)
  }

  const filtered = users.filter((u) => {
    const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
    const matchesRole = !roleFilter || u.role === roleFilter
    return matchesSearch && matchesRole
  })

  return <AdminShell active="users">
    <div className="page-wrap">
      <div className="page-heading">
        <div><p className="eyebrow">Platform administration</p><h1>Users</h1><p className="muted">Manage Atlas Admins, instructors, headteachers and teachers.</p></div>
        <button className="primary-button" onClick={() => setShowCreate(!showCreate)}><Plus size={16} /> Add user</button>
      </div>

      {showCreate && <div className="panel" style={{ marginBottom: 20, maxWidth: 560 }}><div className="panel-head"><h3>Create platform user</h3><button className="icon-button" onClick={() => setShowCreate(false)} aria-label="Close"><X size={17} /></button></div><form onSubmit={createUser} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}><label style={labelStyle}>Full name<input required value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} style={inputStyle} /></label><label style={labelStyle}>Email<input required type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} style={inputStyle} /></label><label style={labelStyle}>Role<select value={createForm.role} onChange={(e) => setCreateForm({ ...createForm, role: e.target.value, schoolId: e.target.value === 'HEADTEACHER' ? createForm.schoolId : '' })} style={inputStyle}><option value="INSTRUCTOR">Instructor</option><option value="ATLAS_ADMIN">Atlas Admin</option><option value="HEADTEACHER">Headteacher</option></select></label>{createForm.role === 'HEADTEACHER' && <label style={labelStyle}>School<select required value={createForm.schoolId} onChange={(e) => setCreateForm({ ...createForm, schoolId: e.target.value })} style={inputStyle}><option value="">Select school</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label>}{createError && <p role="alert" style={{ color: '#b42318', fontSize: 12 }}>{createError}</p>}{setup && <SetupLinkCard label="Setup link generated" setupUrl={setup.url} invitationId={setup.invitationId} expiresAt={setup.expiresAt} />}<button className="primary-button" type="submit">Create invitation</button></form></div>}

      <div className="panel" style={{ marginBottom: 20, overflow: 'hidden', padding: 0 }}>
        <div className="panel-head"><h3><Mail size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />Pending invitations{invitations.length > 0 && <span className="badge badge-pending" style={{ marginLeft: 8 }}>{invitations.length}</span>}</h3></div>
        {resendLink && <div style={{ padding: 12, borderBottom: '1px solid var(--line)' }}><SetupLinkCard label="Setup link generated" setupUrl={resendLink.url} invitationId={resendLink.invitationId} expiresAt={resendLink.expiresAt} /></div>}
        {invitationsLoading ? <p style={{ padding: 16, margin: 0 }}>Loading...</p> : invitations.length === 0 ? (
          <p style={{ padding: 16, margin: 0, color: 'var(--muted)', fontSize: 13 }}>No pending invitations.</p>
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
                      <select
                        aria-label={`Actions for invitation to ${inv.name}`}
                        defaultValue=""
                        style={{ ...selectStyle, minWidth: 140, height: 36, fontSize: 12 }}
                        onChange={(event) => {
                          const action = event.currentTarget.value
                          event.currentTarget.value = ''
                          handleInvitationAction(inv, action)
                        }}
                      >
                        <option value="" disabled>Choose action</option>
                        <option value="resend">Resend link</option>
                        {inv.status !== 'REVOKED' && <option value="revoke">Revoke</option>}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="top-search" style={{ width: '100%', maxWidth: 300 }}>
          <Search size={17} />
          <input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search users" />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={selectStyle}>
          <option value="">All roles</option>
          <option value="ATLAS_ADMIN">Atlas Admin</option>
          <option value="INSTRUCTOR">Instructor</option>
          <option value="HEADTEACHER">Headteacher</option>
          <option value="TEACHER">Teacher</option>
        </select>
      </div>

      {loading ? <p>Loading...</p> : filtered.length === 0 ? (
        <div className="panel" style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>No users found.</div>
      ) : (
        <div className="panel" style={{ overflow: 'hidden', padding: 0 }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>School</th>
                <th>Last active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr key={user.id}>
                  <td><strong>{user.name}</strong></td>
                  <td style={{ color: 'var(--muted)' }}>{user.email}</td>
                  <td><span className={`badge ${roleBadge(user.role)}`}>{formatRole(user.role)}</span></td>
                  <td><span className={`badge ${statusBadge(user.status)}`}>{user.status}</span></td>
                  <td>{user.schoolName || '—'}</td>
                  <td>{user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</td>
                  <td>
                    {user.id === session?.user?.id ? (
                      <span style={{ color: 'var(--muted)', fontSize: 13 }}>You</span>
                    ) : (
                      <select
                        aria-label={`Actions for ${user.name}`}
                        defaultValue=""
                        style={{ ...selectStyle, minWidth: 140, height: 36, fontSize: 12 }}
                        onChange={(event) => {
                          const action = event.currentTarget.value
                          event.currentTarget.value = ''
                          handleUserAction(user, action)
                        }}
                      >
                        <option value="" disabled>Choose action</option>
                        <option value="toggle-status">{user.status === 'DISABLED' ? 'Enable' : 'Disable'}</option>
                        <option value="delete">Delete user</option>
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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

function statusBadge(status: string) {
  switch (status) {
    case 'ACTIVE': return 'badge-active'
    case 'INVITED': return 'badge-pending'
    case 'DISABLED': return 'badge-inactive'
    default: return ''
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
const inputStyle: React.CSSProperties = { height: 40, borderRadius: 8, border: '1px solid var(--line)', padding: '0 12px', fontSize: 13, background: '#fff', width: '100%', marginTop: 4 }
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#374151', display: 'flex', flexDirection: 'column', gap: 3 }
