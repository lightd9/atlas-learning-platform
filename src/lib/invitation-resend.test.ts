import { describe, it, expect } from 'vitest'
import { effectiveInvitationStatus, evaluateInvitationResend, summarizeResendResults } from '@/lib/invitation-resend'

const now = new Date('2026-11-17T12:00:00.000Z')
const email = 'teacher@example.com'

function invitation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'invite-1',
    email,
    status: 'PENDING' as 'PENDING' | 'EXPIRED' | 'ACCEPTED' | 'REVOKED',
    expiresAt: new Date('2026-11-16T12:00:00.000Z'),
    createdAt: new Date('2026-10-01T12:00:00.000Z'),
    updatedAt: new Date('2026-10-01T12:00:00.000Z'),
    ...overrides,
  }
}

const context = { now, existingAccountEmails: new Set<string>(), cooldownMs: 60 * 60 * 1000 }

describe('effectiveInvitationStatus', () => {
  it('derives EXPIRED from a pending invitation past its expiry', () => {
    expect(effectiveInvitationStatus(invitation(), now)).toBe('EXPIRED')
  })

  it('keeps a valid pending invitation as PENDING', () => {
    expect(effectiveInvitationStatus(invitation({ expiresAt: new Date('2026-12-01T12:00:00.000Z') }), now)).toBe('PENDING')
  })
})

describe('evaluateInvitationResend', () => {
  it('allows an expired pending invitation once the resend cooldown has passed', () => {
    const result = evaluateInvitationResend(invitation(), context)
    expect(result.eligible).toBe(true)
    expect(result.reason).toBe('ELIGIBLE')
    expect(result.effectiveStatus).toBe('EXPIRED')
  })

  it('never resurrects revoked or accepted invitations', () => {
    expect(evaluateInvitationResend(invitation({ status: 'REVOKED' }), context).reason).toBe('REVOKED')
    expect(evaluateInvitationResend(invitation({ status: 'ACCEPTED' }), context).reason).toBe('ACCEPTED')
  })

  it('does not resend when an account already exists for the email', () => {
    const result = evaluateInvitationResend(invitation(), {
      ...context,
      existingAccountEmails: new Set([' TEACHER@EXAMPLE.COM ']),
    })
    expect(result.eligible).toBe(false)
    expect(result.reason).toBe('ACCOUNT_EXISTS')
  })

  it('enforces the cooldown from the most recent resend', () => {
    const result = evaluateInvitationResend(invitation({ updatedAt: new Date('2026-11-17T11:45:00.000Z') }), context)
    expect(result.eligible).toBe(false)
    expect(result.reason).toBe('COOLDOWN')
  })
})

describe('summarizeResendResults', () => {
  it('reports partial success instead of failing the whole batch', () => {
    const summary = summarizeResendResults([
      { id: '1', email, status: 'SENT' },
      { id: '2', email: 'revoked@example.com', status: 'SKIPPED', reason: 'REVOKED' },
      { id: '3', email: 'failed@example.com', status: 'FAILED', reason: 'EMAIL_FAILED' },
    ])
    expect(summary).toMatchObject({ sent: 1, skipped: 1, failed: 1, total: 3 })
  })
})
