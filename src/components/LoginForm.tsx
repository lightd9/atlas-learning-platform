'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { getSession, signIn } from 'next-auth/react'
import { ArrowUpRight } from 'lucide-react'
import Logo from '@/components/Logo'
import PasswordInput from '@/components/PasswordInput'
import BackToHome from '@/components/BackToHome'

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedCallbackUrl = searchParams.get('callbackUrl')
  const callbackUrl = requestedCallbackUrl?.startsWith('/') && !requestedCallbackUrl.startsWith('/login')
    ? requestedCallbackUrl
    : '/dashboard'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      setError('Invalid email or password. Please try again.')
    } else {
      const session = await getSession()
      const destination = session?.user?.role === 'ATLAS_ADMIN' || session?.user?.role === 'ATLAS_EMPLOYEE'
        ? '/admin'
        : session?.user?.role === 'INSTRUCTOR'
          ? '/admin/courses'
          : callbackUrl
      router.replace(destination)
      router.refresh()
    }
  }

  return <div className="login-page">
    <div className="login-layout">
      <aside className="login-visual">
        <Link className="login-visual-brand" href="/" aria-label="Atlas Learning home"><Logo /></Link>
        <p className="login-visual-caption">Your school&apos;s learning space is private and secure.</p>
      </aside>
      <div className="login-card">
      <BackToHome />
      <h1>Welcome back.</h1>
      <p className="muted">Log in with the email address your school used to invite you.</p>
      <form onSubmit={handleSubmit}>
        {error && <p style={{ color: '#00000', fontSize: 12, marginBottom: 16, padding: '10px 14px', background: '#b42318', borderRadius: 8 }}>{error}</p>}
        <label htmlFor="email">Email address</label>
        <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.org" required />
        <label htmlFor="password">Password</label>
        <PasswordInput id="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required />
        <div className="login-options">
          <label><input type="checkbox" /> <span>Remember me</span></label>
          <Link className="login-forgot" href="/forgot-password">Forgot password?</Link>
        </div>
        <button className="primary-button login-submit" type="submit" disabled={loading}>
          {loading ? 'Signing in...' : <>Log in <ArrowUpRight size={16} /></>}
        </button>
      </form>
      <p className="login-help">First time here? Check your setup email or <Link href="/contact">contact Atlas Support</Link>.</p>
      </div>
    </div>
  </div>
}



