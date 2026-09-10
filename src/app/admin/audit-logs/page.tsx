'use client'

import { useEffect, useState } from 'react'
import { ClipboardList, RefreshCw, Search } from 'lucide-react'
import AdminShell from '@/components/AdminShell'

type AuditLog = {
  id: string
  action: string
  userId: string | null
  schoolId: string | null
  details: string | null
  createdAt: string
  user: { name: string | null; email: string | null } | null
  school: { name: string } | null
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  async function load() {
    setLoading(true); setError('')
    const query = search ? `?search=${encodeURIComponent(search)}` : ''
    const response = await fetch(`/api/admin/audit-logs${query}`)
    const data = await response.json()
    if (!response.ok) setError(data.error ?? 'Unable to load audit history')
    setLogs(data.logs ?? []); setLoading(false)
  }

  useEffect(() => { load().catch(() => { setError('Unable to load audit history'); setLoading(false) }) }, [])
  useEffect(() => { const timer = setTimeout(() => load().catch(() => { setError('Unable to load audit history'); setLoading(false) }), 300); return () => clearTimeout(timer) }, [search])

  return <AdminShell active="audit"><div className="page-wrap">
    <div className="page-heading compact"><div><p className="eyebrow">Platform governance</p><h1>Audit history</h1><p className="muted">Review important invitation, account and platform actions.</p></div><button className="secondary-button" onClick={load}><RefreshCw size={16} /> Refresh</button></div>
    <div className="filter-row">
      <div className="top-search" style={{ marginRight: 'auto', height: 40 }}>
        <Search size={16} />
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search actions, details, users or schools…" aria-label="Search audit history" />
      </div>
    </div>
    {error && <p role="alert" style={{ color: '#b42318' }}>{error}</p>}
    {loading ? <p>Loading audit history...</p> : logs.length === 0 ? <div className="panel" style={{ padding: 32, textAlign: 'center' }}><ClipboardList size={28} color="var(--blue)" /><h3>No audit activity yet</h3><p className="muted">Actions will appear here as the platform is used.</p></div> : <div className="panel" style={{ overflow: 'hidden', padding: 0 }}><div className="table-wrap"><table className="admin-table"><thead><tr><th>When</th><th>Action</th><th>Details</th><th>User</th><th>School</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id}><td>{new Date(log.createdAt).toLocaleString('en-GB')}</td><td><span className="badge badge-active">{log.action}</span></td><td>{log.details ?? '—'}</td><td>{log.user ? `${log.user.name ?? 'Unnamed'}${log.user.email ? ` (${log.user.email})` : ''}` : 'System'}</td><td>{log.school?.name ?? 'Platform'}</td></tr>)}</tbody></table></div></div>}
  </div></AdminShell>
}
