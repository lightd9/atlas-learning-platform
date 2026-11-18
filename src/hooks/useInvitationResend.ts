'use client'

import { useRef, useState } from 'react'
import { summarizeResendResults, type ResendResult } from '@/lib/invitation-resend'

export type DisplayResendResult = ResendResult & { message: string }

export function useInvitationResend() {
  const sending = useRef(false)
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<DisplayResendResult[] | null>(null)

  async function resend(requestedIds: string[], schoolId?: string) {
    const ids = [...new Set(requestedIds)]
    if (sending.current || !ids.length) return null
    sending.current = true
    setBusy(true)
    setResults(null)
    const combined: DisplayResendResult[] = []
    try {
      // Small requests keep large schools within the route execution window.
      for (let index = 0; index < ids.length; index += 25) {
        const batch = ids.slice(index, index + 25)
        try {
          const response = await fetch('/api/invitations/resend', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: batch, ...(schoolId ? { schoolId } : {}) }),
          })
          const data = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error(data.error ?? 'Unable to resend invitations.')
          combined.push(...(data.results ?? []))
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unable to confirm delivery. Refresh before retrying.'
          combined.push(...ids.slice(index).map((id) => ({ id, email: '', status: 'FAILED' as const, message })))
          break
        }
        setResults([...combined])
      }
      setResults(combined)
      return summarizeResendResults(combined)
    } finally {
      sending.current = false
      setBusy(false)
    }
  }
  return { resend, busy, results }
}
