'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import Logo from '@/components/Logo'
import PasswordInput from '@/components/PasswordInput'
import BackToHome from '@/components/BackToHome'
import { useToast } from '@/components/Toast'

export default function ChangePasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedCallbackUrl = searchParams.get('callbackUrl')
  const callbackUrl = requestedCallbackUrl?.startsWith('/') && !requestedCallbackUrl.startsWith('/login')
    ? requestedCallbackUrl
    : '/dashboard'
  const { toast } = useToast()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    if (newPassword.length < 8) { setError('Use a new password with at least 8 characters.'); return }
    if (newPassword !== confirmPassword) { setError('New passwords do not match.'); return }
    setLoading(true)
    const res = await fetch('/api/account/password/must-change', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newPassword }) })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      const messageText = data.error ?? 'Unable to update password'
      setError(messageText)
      toast(messageText, 'error')
      return
    }
    setMessage('Your password has been updated.')
    toast('Password updated', 'success')
    setTimeout(() => { router.replace(callbackUrl); router.refresh() }, 1200)
  }

  return (
    <div className="login-page">
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="login-card" style={{ width: '100%', maxWidth: 460 }}>
          <BackToHome />
          <p style={{ margin: '24px 0 4px' }}><Logo /></p>
          <h1>Choose a new password</h1>
          <p className="muted">Your administrator reset your password. Set a new one to continue.</p>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
            {error && <p role="alert" style={{ color: '#fff', fontSize: 12, margin: 0, padding: '10px 14px', background: '#b42318', borderRadius: 8 }}>{error}</p>}
            {message && <p role="status" style={{ color: 'var(--green)', fontSize: 13, margin: 0 }}><CheckCircle2 size={15} style={{ verticalAlign: 'middle', marginRight: 4 }} />{message}</p>}
            <label htmlFor="new-password">New password</label>
            <PasswordInput id="new-password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters" required />
            <label htmlFor="confirm-password">Confirm new password</label>
            <PasswordInput id="confirm-password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat your new password" required />
            <button className="primary-button login-submit" type="submit" disabled={loading || Boolean(message)}>
              {loading ? 'Updating...' : <>Save new password <ArrowRight size={16} /></>}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}