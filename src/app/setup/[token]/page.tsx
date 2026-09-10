'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/Logo'
import PasswordInput from '@/components/PasswordInput'
import BackToHome from '@/components/BackToHome'

export default function SetupPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [valid, setValid] = useState(false)
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch(`/api/auth/check-setup-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const data = await res.json()
        if (!res.ok) { setExpired(true); setLoading(false); return }
        setName(data.name || '')
        setValid(true)
      } catch {
        setExpired(true)
      }
      setLoading(false)
    }
    check()
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }

    const res = await fetch('/api/auth/setup-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, name, password }),
    })
    if (!res.ok) { const d = await res.json(); setError(d.error || 'Setup failed'); return }
    router.push('/login?setup=success')
  }

  if (loading) {
    return (
      <div className="login-page">
        <div className="login-layout">
          <aside className="login-visual">
            <Link type="button" className="login-visual-brand" href="/" aria-label="Atlas Learning home"><Logo /></Link>
            <p className="login-visual-caption">Your school&apos;s learning space is private and secure.</p>
          </aside>
          <div className="login-card" style={{ textAlign: 'center' }}>
            <BackToHome />
            <p>Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  if (expired) {
    return (
      <div className="login-page">
        <div className="login-layout">
          <aside className="login-visual">
            <Link className="login-visual-brand" href="/" aria-label="Atlas Learning home"><Logo /></Link>
            <p className="login-visual-caption">Your school&apos;s learning space is private and secure.</p>
          </aside>
          <div className="login-card" style={{ textAlign: 'center' }}>
            <BackToHome />
            <h1>Link expired</h1>
            <p className="muted">This invitation link has expired. Request a fresh setup link using the same email address.</p>
            <Link href="/resend-invitation" className="primary-button login-submit">Request new link</Link>
            <Link href="/login" className="text-button" style={{ marginTop: 16, display: 'inline-block' }}>Go to login</Link>
          </div>
        </div>
      </div>
    )
  }

return (
    <div className="login-page">
      <div className="login-layout">
        <aside className="login-visual">
          <Link className="login-visual-brand" href="/" aria-label="Atlas Learning home"><Logo /></Link>
          <p className="login-visual-caption">Your school&apos;s learning space is private and secure.</p>
        </aside>
        <div className="login-card">
          <BackToHome />
          <h1>Set up your account</h1>
          <p className="muted">Welcome{name ? `, ${name}` : ''}! Choose a password to get started.</p>
          <form onSubmit={handleSubmit}>
            {error && <p style={{ color: '#00000', fontSize: 12, marginBottom: 16, padding: '10px 14px', background: '#b42318', borderRadius: 8 }}>{error}</p>}
            <label htmlFor="name">Full name</label>
            <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Your name" />
            <label htmlFor="password">Password</label>
            <PasswordInput id="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="At least 8 characters" />
            <label htmlFor="confirm">Confirm password</label>
            <PasswordInput id="confirm" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required placeholder="Repeat your password" />
            <button type="submit" className="primary-button login-submit">Create account</button>
          </form>
        </div>
      </div>
    </div>
  )
}
