'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { signIn } from 'next-auth/react'
import { ArrowUpRight } from 'lucide-react'
import Logo from '@/components/Logo'
import PasswordInput from '@/components/PasswordInput'
import BackToHome from '@/components/BackToHome'

export default function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('school') ?? searchParams.get('token') ?? ''
  const [checking, setChecking] = useState(true)
  const [schoolName, setSchoolName] = useState<string | null>(null)
  const [invalid, setInvalid] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token) { setInvalid(true); setChecking(false); return }
    let active = true
    fetch(`/api/public/school-registration?school=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => { if (active) { setSchoolName(data.schoolName ?? null); setInvalid(!data.valid) } })
      .catch(() => { if (active) setInvalid(true) })
      .finally(() => { if (active) setChecking(false) })
    return () => { active = false }
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    const res = await fetch('/api/public/school-registration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, name, email, password }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setLoading(false); setError(data.error ?? 'Unable to create your account.'); return }
    const result = await signIn('credentials', { email, password, redirect: false })
    setLoading(false)
    if (result?.error) {
      router.replace('/login?registered=1')
      return
    }
    router.replace('/dashboard')
    router.refresh()
  }

  return <div className="login-page">
    <div className="login-layout">
      <aside className="login-visual">
        <Link className="login-visual-brand" href="/" aria-label="Atlas Learning home"><Logo /></Link>
        <p className="login-visual-caption">Your school&apos;s learning space is private and secure.</p>
      </aside>
      <div className="login-card">
        <BackToHome />
        {checking ? <p className="muted">Checking your registration link…</p> : invalid ? <>
          <h1>Link unavailable.</h1>
          <p className="muted">This parent registration link is invalid, disabled, or the school is inactive. Please ask your school for a current link.</p>
          <p className="login-help">Already have an account? <Link href="/login">Log in</Link>.</p>
        </> : <>
          <h1>Create your parent account.</h1>
          <p className="muted">Join {schoolName ?? 'your school'}&apos;s learning space.</p>
          <form onSubmit={handleSubmit}>
            {error && <p role="alert" style={{ color: '#fff', fontSize: 12, marginBottom: 16, padding: '10px 14px', background: '#b42318', borderRadius: 8 }}>{error}</p>}
            <label htmlFor="name">Full name</label>
            <input id="name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" required />
            <label htmlFor="email">Email address</label>
            <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" required />
            <label htmlFor="password">Password</label>
            <PasswordInput id="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" required />
            <label htmlFor="confirm">Confirm password</label>
            <PasswordInput id="confirm" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter your password" required />
            <button className="primary-button login-submit" type="submit" disabled={loading}>
              {loading ? 'Creating account…' : <>Sign up <ArrowUpRight size={16} /></>}
            </button>
          </form>
          <p className="login-help">Already have an account? <Link href="/login">Log in</Link>.</p>
        </>}
      </div>
    </div>
  </div>
}
