'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/Logo'
import PasswordInput from '@/components/PasswordInput'
import BackToHome from '@/components/BackToHome'

export default function ResetPasswordPage() {
  const params = useParams()
  const router = useRouter()
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

  if (step === 'error') {
    return (
      <div className="login-page">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <BackToHome />
          <span className="login-symbol">!</span>
          <h2>Link expired</h2>
          <p className="muted">{error}</p>
          <Link href="/forgot-password" className="primary-button" style={{ display: 'inline-flex', marginTop: 16 }}>Request new link</Link>
        </div>
      </div>
    )
  }

  if (step === 'done') {
    return (
      <div className="login-page">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <BackToHome />
          <span className="login-symbol">✓</span>
          <h2>Password reset</h2>
          <p className="muted">Your password has been updated. You can now log in.</p>
          <Link href="/login" className="primary-button" style={{ display: 'inline-flex', marginTop: 16 }}>Log in</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="login-page">
      <Link href="/" className="login-brand"><Logo /></Link>
      {step === 'email' ? (
        <div className="login-card">
          <BackToHome />
          <span className="login-symbol">🔑</span>
          <h2>Reset password</h2>
          <p className="muted">Enter the email associated with your account.</p>
          <form onSubmit={handleEmailSubmit}>
            <label>Email <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@school.edu" /></label>
            <button type="submit" className="primary-button" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}>Continue</button>
          </form>
        </div>
      ) : (
        <div className="login-card">
          <BackToHome />
          <span className="login-symbol">🔑</span>
          <h2>New password</h2>
          <p className="muted">Choose a new password for {email}</p>
          <form onSubmit={handleReset}>
            <label>New password <PasswordInput autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="At least 8 characters" /></label>
            <label>Confirm <PasswordInput autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required placeholder="Repeat your password" /></label>
            {error && <p style={{ color: '#e53e3e', fontSize: 12 }}>{error}</p>}
            <button type="submit" className="primary-button" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}>Reset password</button>
          </form>
        </div>
      )}
    </div>
  )
}
