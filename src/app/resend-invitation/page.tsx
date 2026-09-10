'use client'

import Link from 'next/link'
import { useState } from 'react'
import Logo from '@/components/Logo'

export default function ResendInvitationPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError('')
    const response = await fetch('/api/auth/resend-invitation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
    if (response.ok) setSent(true)
    else { const data = await response.json(); setError(data.error ?? 'Unable to request a new invitation.') }
  }

  return <div className="login-page"><Link href="/" className="login-brand"><Logo /></Link><div className="login-card">
    {sent ? <><span className="login-symbol">✓</span><h2>Check your email</h2><p className="muted">If there is an invitation for this address, Atlas Support has sent a fresh setup link.</p><Link href="/login" className="text-button">Back to login</Link></> : <><span className="login-symbol">↻</span><h2>Resend setup link</h2><p className="muted">Enter the email address from your Atlas invitation and we&apos;ll send a new link if one is available.</p><form onSubmit={submit}><label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>{error && <p role="alert" style={{ color: '#b42318', fontSize: 12 }}>{error}</p>}<button className="primary-button" type="submit" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}>Send new link</button></form><Link href="/login" className="text-button" style={{ display: 'block', marginTop: 16, textAlign: 'center' }}>Back to login</Link></>}
  </div></div>
}
