'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import PasswordInput from '@/components/PasswordInput'

interface SetPasswordModalProps {
  title: string
  description: string
  subject: string
  subjectLabel?: string
  confirmLabel?: string
  busy?: boolean
  error?: string
  onConfirm: (password: string) => void
  onClose: () => void
}

export default function SetPasswordModal({
  title,
  description,
  subject,
  subjectLabel,
  confirmLabel = 'Set password',
  busy = false,
  error,
  onConfirm,
  onClose,
}: SetPasswordModalProps) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [localError, setLocalError] = useState('')

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLocalError('')
    if (password.length < 8) { setLocalError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setLocalError('Passwords do not match.'); return }
    onConfirm(password)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50 }}>
      <div className="panel" style={{ width: '100%', maxWidth: 440, padding: 24 }}>
        <div className="panel-head">
          <div><p className="eyebrow">{subjectLabel ?? subject}</p><h3>{title}</h3></div>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X size={17} /></button>
        </div>
        <p className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>{description}<br /><strong>{subject}</strong></p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'flex', flexDirection: 'column', gap: 5 }}>
            New password
            <PasswordInput autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" style={{ height: 40, borderRadius: 8, border: '1px solid var(--line)', padding: '0 12px', fontSize: 13, width: '100%' }} />
          </label>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'flex', flexDirection: 'column', gap: 5 }}>
            Confirm new password
            <PasswordInput autoComplete="new-password" minLength={8} value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder="Repeat the password" style={{ height: 40, borderRadius: 8, border: '1px solid var(--line)', padding: '0 12px', fontSize: 13, width: '100%' }} />
          </label>
          {(localError || error) && <p role="alert" style={{ color: '#b42318', fontSize: 12, margin: 0 }}>{localError || error}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Saving...' : confirmLabel}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
