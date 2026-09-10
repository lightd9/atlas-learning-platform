'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/Logo'
import PasswordInput from '@/components/PasswordInput'
import BackToHome from '@/components/BackToHome'

export default function ResetPasswordPage() {
  const params = useParams()
  const token = params.token as string
  const [step, setStep] = useState<'email' | 'reset' | 'done' | 'error'>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')

  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (email) setStep('reset')
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }

    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password, email }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setStep('error'); return }
    setStep('done')
  }

  return (
    <div className="login-page">
      <div className="login-layout">
        <aside className="login-visual">
          <Link className="login-visual-brand" href="/" aria-label="Atlas Learning home"><Logo /></Link>
          <p className="login-visual-caption">Your school&apos;s learning space is private and secure.</p>
        </aside>
        <div className="login-card">
          {step === 'error' && (
            <div style={{ textAlign: 'center' }}>
              <BackToHome />
              <h1>Link expired</h1>
              <p className="muted">{error}</p>
              <Link href="/forgot-password" className="primary-button login-submit" style={{ marginTop: 16 }}>Request new link</Link>
            </div>
          )}

          {step === 'done' && (
            <div style={{ textAlign: 'center' }}>
              <BackToHome />
              <h1>Password reset</h1>
              <p className="muted">Your password has been updated. You can now log in.</p>
              <Link href="/login" className="primary-button login-submit" style={{ marginTop: 16 }}>Log in</Link>
            </div>
          )}

          {step === 'email' && (
            <>
              <BackToHome />
              <h1>Reset password</h1>
              <p className="muted">Enter the email associated with your account.</p>
              <form onSubmit={handleEmailSubmit}>
                <label htmlFor="email">Email address</label>
                <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.org" required />
                <button className="primary-button login-submit" type="submit">Continue</button>
              </form>
            </>
          )}

          {step === 'reset' && (
            <>
              <BackToHome />
              <h1>New password</h1>
              <p className="muted">Choose a new password for {email}</p>
              <form onSubmit={handleReset}>
                {error && <p style={{ color: '#00000', fontSize: 12, marginBottom: 16, padding: '10px 14px', background: '#b42318', borderRadius: 8 }}>{error}</p>}
                <label htmlFor="password">New password</label>
                <PasswordInput id="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="At least 8 characters" />
                <label htmlFor="confirm">Confirm password</label>
                <PasswordInput id="confirm" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required placeholder="Repeat your password" />
                <button className="primary-button login-submit" type="submit">Reset password</button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}