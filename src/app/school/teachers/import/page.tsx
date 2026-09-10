'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ArrowLeft, FileUp, Upload, CheckCircle2, AlertCircle, Download } from 'lucide-react'
import AuthShell from '@/components/AuthShell'
import AdminShell from '@/components/AdminShell'
import { useToast } from '@/components/Toast'

export default function ImportTeachersPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const { toast } = useToast()
  const [adminSchoolId, setAdminSchoolId] = useState<string | null>(null)
  useEffect(() => { setAdminSchoolId(new URLSearchParams(window.location.search).get('schoolId')) }, [])
  const isAdminImport = session?.user?.role === 'ATLAS_ADMIN' && Boolean(adminSchoolId)
  const fileInput = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)

  async function handleUpload() {
    if (!file) return
    setLoading(true)
    setError('')
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)
    if (adminSchoolId) formData.append('schoolId', adminSchoolId)

    const res = await fetch('/api/invitations/import-csv', {
      method: 'POST',
      body: formData,
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      const message = data.error || 'Failed to process CSV'; setError(message); toast(message, 'error')
      setResult(data)
      return
    }
    setResult(data)
  }

  async function handleConfirmImport() {
    if (!result || !file) return
    setImporting(true)
    setError('')

    // Now create the invitations
    const validEmails = result.results?.filter((r: any) => r.valid && !result.existingActive?.includes(r.email) && !result.existingPending?.includes(r.email)) || []

    const createRes = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(adminSchoolId ? { schoolId: adminSchoolId } : {}),
        invitations: validEmails.map((r: any) => ({ name: r.name, email: r.email })),
      }),
    })
    const createData = await createRes.json()
    setImporting(false)
    if (createRes.ok) {
      setImportResult({ sent: createData.invitations.length })
      toast(`${createData.invitations.length} user${createData.invitations.length === 1 ? '' : 's'} added`, 'success')
    } else {
      const message = createData.error || 'Failed to send invitations'; setError(message); toast(message, 'error')
    }
  }

  function downloadErrorReport() {
    const invalidRows = result?.results?.filter((row: any) => !row.valid) ?? []
    const csv = ['row,name,email,error', ...invalidRows.map((row: any) => [row.row, row.name, row.email, row.error].map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = 'atlas-teacher-import-errors.csv'; link.click(); URL.revokeObjectURL(url)
  }

  const hasExistingConflict = result?.existingActive?.length > 0 || result?.existingPending?.length > 0

  const PageShell = isAdminImport ? AdminShell : AuthShell
  return <PageShell active={isAdminImport ? 'schools' : 'Manage teachers'}>
    <div className="page-wrap">
      <div className="page-heading compact">
        <div>
          <button className="text-button" onClick={() => router.push(isAdminImport ? `/admin/schools/${adminSchoolId}` : '/school/teachers')} style={{ marginBottom: 8, display: 'inline-flex' }}>
            <ArrowLeft size={16} /> Back to teachers
          </button>
          <p className="eyebrow">{isAdminImport ? 'School management' : 'Your school'}</p>
          <h1>Import teachers</h1>
          <p className="muted">Upload a CSV file to invite multiple teachers at once.</p>
        </div>
      </div>

      {!importResult ? (
        <div className="panel" style={{ maxWidth: 600 }}>
          <h3 style={{ margin: '0 0 8px' }}>Upload CSV</h3>
          <p className="muted" style={{ fontSize: 13, margin: '0 0 12px' }}>
            Your CSV should have <strong>name</strong> and <strong>email</strong> columns.
          </p>
          <a className="text-button" href="/api/invitations/template" download style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 20, fontSize: 13 }}>
            <Download size={15} /> Download template
          </a>

          <div
            className="upload-card"
            style={{ cursor: 'pointer', border: '2px dashed var(--line)', borderRadius: 12, padding: 40, textAlign: 'center', flexDirection: 'column', gap: 12 }}
            onClick={() => fileInput.current?.click()}
          >
            <FileUp size={32} style={{ color: 'var(--blue)' }} />
            <strong>{file ? file.name : 'Click to select a CSV file'}</strong>
            {file && <span className="muted" style={{ fontSize: 12 }}>{(file.size / 1024).toFixed(1)} KB</span>}
            <input ref={fileInput} type="file" accept=".csv" hidden onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); setError('') }} />
          </div>

          {file && !result && (
            <button className="primary-button" onClick={handleUpload} disabled={loading} style={{ marginTop: 16, width: '100%', justifyContent: 'center' }}>
              {loading ? 'Processing...' : <><Upload size={17} /> Preview import</>}
            </button>
          )}

          {error && !result && (
            <div style={{ marginTop: 16, padding: '12px 16px', background: '#b42318', borderRadius: 8, color: '#fff', fontSize: 13 }}>
              <AlertCircle size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />{error}
            </div>
          )}

          {result && (
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                <div className="team-stat" style={{ flex: 1, textAlign: 'center' }}>
                  <span>Valid</span>
                  <strong style={{ color: 'var(--green)' }}>{result.canImport}</strong>
                </div>
                <div className="team-stat" style={{ flex: 1, textAlign: 'center' }}>
                  <span>Invalid</span>
                  <strong style={{ color: '#e53e3e' }}>{result.invalidRows}</strong>
                </div>
                <div className="team-stat" style={{ flex: 1, textAlign: 'center' }}>
                  <span>Existing</span>
                  <strong style={{ color: '#d97706' }}>{(result.existingActive?.length || 0) + (result.existingPending?.length || 0)}</strong>
                </div>
              </div>

              {hasExistingConflict && (
                <div style={{ padding: '10px 14px', background: '#f5b700', borderRadius: 8, fontSize: 12, color: '#101828', marginBottom: 12 }}>
                  {result.existingActive?.length > 0 && <div>Active accounts: {result.existingActive.join(', ')}</div>}
                  {result.existingPending?.length > 0 && <div>Pending invitations: {result.existingPending.join(', ')}</div>}
                </div>
              )}

              {result.results?.filter((r: any) => !r.valid).length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}><p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px' }}>Invalid rows:</p><button className="text-button" onClick={downloadErrorReport}><Download size={14} /> Download error report</button></div>
                  <table className="admin-table" style={{ fontSize: 12 }}>
                    <thead><tr><th>Row</th><th>Name</th><th>Email</th><th>Error</th></tr></thead>
                    <tbody>
                      {result.results.filter((r: any) => !r.valid).map((r: any) => (
                        <tr key={r.row}>
                          <td>{r.row}</td>
                          <td>{r.name}</td>
                          <td>{r.email}</td>
                          <td style={{ color: '#e53e3e' }}>{r.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {result.canImport > 0 && (
                <button className="primary-button" onClick={handleConfirmImport} disabled={importing} style={{ width: '100%', justifyContent: 'center' }}>
                  {importing ? 'Sending invitations...' : `Send ${result.canImport} invitation${result.canImport !== 1 ? 's' : ''}`}
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="panel" style={{ maxWidth: 600, textAlign: 'center', padding: 40 }}>
          <CheckCircle2 size={48} style={{ color: 'var(--green)', marginBottom: 12 }} />
          <h2 style={{ margin: '0 0 8px' }}>Invitations sent</h2>
          <p className="muted">{importResult.sent} invitation{importResult.sent !== 1 ? 's' : ''} sent successfully.</p>
          <button className="primary-button" onClick={() => router.push(isAdminImport ? `/admin/schools/${adminSchoolId}` : '/school/teachers')} style={{ marginTop: 20 }}>
            Back to teachers
          </button>
        </div>
      )}
    </div>
  </PageShell>
}
