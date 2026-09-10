'use client'

import { useEffect, useState } from 'react'
import { useToast } from '@/components/Toast'

interface SetupLinkCardProps {
  label: string
  setupUrl: string
  invitationId?: string | null
  expiresAt?: string | null
}

export default function SetupLinkCard({ label, setupUrl, invitationId, expiresAt }: SetupLinkCardProps) {
  const { toast } = useToast()
  const [url, setUrl] = useState(setupUrl)
  const [expiry, setExpiry] = useState(expiresAt ? new Date(expiresAt).getTime() : Date.now())
  const [now, setNow] = useState(Date.now())
  const [sending, setSending] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const remaining = Math.max(0, expiry - now)
  const expired = remaining <= 0
  const hours = Math.floor(remaining / 3600000)
  const minutes = Math.floor((remaining % 3600000) / 60000)
  const seconds = Math.floor((remaining % 60000) / 1000)
  const countdown = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`

  async function resend() {
    if (!invitationId || sending) return
    setSending(true)
    const res = await fetch(`/api/invitations/${invitationId}`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    setSending(false)
    if (!res.ok || !data.invitation?.setupToken) { toast('Unable to send a new link', 'error'); return }
    setUrl(`${window.location.origin}/setup/${data.invitation.setupToken}`)
    setExpiry(new Date(data.invitation.expiresAt ?? Date.now() + 7 * 24 * 60 * 60 * 1000).getTime())
    setNow(Date.now())
    toast('New link sent', 'success')
  }

  return (
    <div style={{ background: expired ? '#fef3f2' : '#ecfdf3', padding: 10, borderRadius: 8 }}>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>{label}</p>
      <p style={{ margin: '6px 0 0', fontSize: 12 }}><a href={url} style={{ overflowWrap: 'anywhere' }}>{url}</a></p>
      <p style={{ margin: '6px 0 0', fontSize: 12 }}>
        {expired ? 'Link expired.' : <>Link valid for <strong>{countdown}</strong>.</>}
      </p>
      {expired && invitationId && (
        <button type="button" className="secondary-button" style={{ marginTop: 8, height: 30, fontSize: 12 }} onClick={resend} disabled={sending}>
          {sending ? 'Sending...' : 'Send another link'}
        </button>
      )}
    </div>
  )
}