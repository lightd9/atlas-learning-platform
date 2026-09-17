'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Users, Search, Plus, X, Mail, Power, ShieldCheck, Trash2 } from 'lucide-react'
import AdminShell from '@/components/AdminShell'
import SetupLinkCard from '@/components/SetupLinkCard'
import { useToast } from '@/components/Toast'
import type { AdminUser } from '@/types/api'

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
  const [editingPermissions, setEditingPermissions] = useState<AdminUser | null>(null)
  const [permissionDraft, setPermissionDraft] = useState<string[]>([])
  const permissionOptions = [{ key: 'COURSE_CREATE', label: 'Create courses' }, { key: 'COURSE_EDIT_OWN', label: 'Edit own courses' }, { key: 'COURSE_EDIT_ALL', label: 'Edit all courses' }, { key: 'COURSE_PUBLISH', label: 'Publish and unpublish courses' }, { key: 'COURSE_DELETE', label: 'Delete courses' }, { key: 'SCHOOL_ASSIGN', label: 'Assign courses to schools' }, { key: 'ANALYTICS_VIEW', label: 'View analytics' }, { key: 'SCHOOL_CREATE', label: 'Create schools' }, { key: 'USER_CREATE', label: 'Create users' }, { key: 'USER_DELETE', label: 'Delete users' }, { key: 'AUDIT_VIEW', label: 'View audit history' }]

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated' && session?.user?.role !== 'ATLAS_ADMIN') { router.push('/dashboard'); return }
    if (status === 'authenticated') {
      Promise.all([fetch('/api/admin/users').then((r) => r.json()), fetch('/api/admin/schools').then((r) => r.json())]).then(([d, s]) => { setUsers(d.users ?? []); setSchools((s.schools ?? []).map((school: any) => ({ id: school.id, name: school.name }))); setLoading(false) }).catch(() => setLoading(false))
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

  async function savePermissions() {
    if (!editingPermissions) return
    const res = await fetch(`/api/admin/users/${editingPermissions.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ permissions: permissionDraft }) })
    if (!res.ok) { toast('Unable to update permissions', 'error'); return }
    setUsers(users.map((user) => user.id === editingPermissions.id ? { ...user, permissions: permissionDraft } : user)); setEditingPermissions(null); toast('Permissions updated', 'success')
  }

  function handleUserAction(user: AdminUser, action: string) {
    if (action === 'toggle-status') toggleUser(user)
    if (action === 'delete') deleteUser(user)
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="secondary-button" onClick={() => router.push('/admin/invitations')}><Mail size={16} /> Pending invitations</button>
          <button className="primary-button" onClick={() => setShowCreate(!showCreate)}><Plus size={16} /> Add user</button>
        </div>
      </div>

      {showCreate && <div className="panel" style={{ marginBottom: 20, maxWidth: 560 }}><div className="panel-head"><h3>Create platform user</h3><button className="icon-button" onClick={() => setShowCreate(false)} aria-label="Close"><X size={17} /></button></div><form onSubmit={createUser} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}><label style={labelStyle}>Full name<input required value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} style={inputStyle} /></label><label style={labelStyle}>Email<input required type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} style={inputStyle} /></label><label style={labelStyle}>Role<select value={createForm.role} onChange={(e) => setCreateForm({ ...createForm, role: e.target.value, schoolId: e.target.value === 'HEADTEACHER' ? createForm.schoolId : '' })} style={inputStyle}><option value="INSTRUCTOR">Instructor</option><option value="ATLAS_EMPLOYEE">Atlas Employee</option><option value="ATLAS_ADMIN">Atlas Admin</option><option value="HEADTEACHER">Headteacher</option></select></label>{createForm.role === 'HEADTEACHER' && <label style={labelStyle}>School<select required value={createForm.schoolId} onChange={(e) => setCreateForm({ ...createForm, schoolId: e.target.value })} style={inputStyle}><option value="">Select school</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label>}{createError && <p role="alert" style={{ color: '#b42318', fontSize: 12 }}>{createError}</p>}{setup && <SetupLinkCard label="Setup link generated" setupUrl={setup.url} invitationId={setup.invitationId} expiresAt={setup.expiresAt} />}<button className="primary-button" type="submit">Create invitation</button></form></div>}
      {editingPermissions && <div className="panel" style={{ marginBottom: 20, maxWidth: 560 }}><div className="panel-head"><div><p className="eyebrow">Instructor access</p><h3>Edit permissions for {editingPermissions.name}</h3></div><button className="icon-button" onClick={() => setEditingPermissions(null)} aria-label="Close permissions editor"><X size={17} /></button></div><p className="muted" style={{ marginBottom: 14 }}>Choose the Atlas functions this instructor can use.</p><div style={{ display: 'grid', gap: 9 }}>{permissionOptions.map((permission) => <label key={permission.key} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13 }}><input type="checkbox" checked={permissionDraft.includes(permission.key)} onChange={(event) => setPermissionDraft(event.target.checked ? [...permissionDraft, permission.key] : permissionDraft.filter((item) => item !== permission.key))} />{permission.label}</label>)}</div><div style={{ display: 'flex', gap: 8, marginTop: 18 }}><button className="primary-button" onClick={savePermissions}>Save permissions</button><button className="secondary-button" onClick={() => setEditingPermissions(null)}>Cancel</button></div></div>}

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="top-search" style={{ width: '100%', maxWidth: 300 }}>
          <Search size={17} />
          <input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search users" />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={selectStyle}>
          <option value="">All roles</option>
          <option value="ATLAS_ADMIN">Atlas Admin</option><option value="ATLAS_EMPLOYEE">Atlas Employee</option>
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
                      <span style={{ display: 'inline-flex', gap: 5 }} aria-label={`Actions for ${user.name}`}>
                        <button className="icon-button" title={user.status === 'DISABLED' ? 'Enable user' : 'Disable user'} aria-label={`${user.status === 'DISABLED' ? 'Enable' : 'Disable'} ${user.name}`} onClick={() => toggleUser(user)}><Power size={16} /></button>
                        {user.role === 'ATLAS_EMPLOYEE' && <button className="icon-button" title="Edit permissions" aria-label={`Edit permissions for ${user.name}`} onClick={() => { setEditingPermissions(user); setPermissionDraft(user.permissions ?? []) }}><ShieldCheck size={16} /></button>}
                        <button className="icon-button" title="Delete user" aria-label={`Delete ${user.name}`} onClick={() => deleteUser(user)}><Trash2 size={16} style={{ color: '#b42318' }} /></button>
                      </span>
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
    case 'ATLAS_EMPLOYEE': return 'Atlas Employee'
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

const selectStyle: React.CSSProperties = {
  height: 40, borderRadius: 8, border: '1px solid var(--line)', padding: '0 12px', fontSize: 13, background: '#fff', minWidth: 140,
}
const inputStyle: React.CSSProperties = { height: 40, borderRadius: 8, border: '1px solid var(--line)', padding: '0 12px', fontSize: 13, background: '#fff', width: '100%', marginTop: 4 }
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#374151', display: 'flex', flexDirection: 'column', gap: 3 }
