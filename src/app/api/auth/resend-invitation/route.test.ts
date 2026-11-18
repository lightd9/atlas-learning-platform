import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ invitation: vi.fn(), account: vi.fn(), limit: vi.fn(), deliver: vi.fn(), audit: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { invitation: { findFirst: mocks.invitation }, user: { findFirst: mocks.account } } }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: mocks.limit }))
vi.mock('@/lib/invitation-delivery', () => ({ deliverInvitationResend: mocks.deliver }))
vi.mock('@/lib/audit', () => ({ auditLog: mocks.audit }))
import { POST } from '@/app/api/auth/resend-invitation/route'

const invitation = { id: 'invitation', email: 'teacher@example.test', status: 'PENDING', expiresAt: new Date('2099-01-01'), createdAt: new Date('2020-01-01'), updatedAt: new Date('2020-01-01'), invitedById: 'manager', schoolId: 'school' }
const request = (email = invitation.email) => new Request('http://localhost/api/auth/resend-invitation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })

beforeEach(() => {
  vi.resetAllMocks()
  mocks.invitation.mockResolvedValue(invitation)
  mocks.account.mockResolvedValue(null)
  mocks.limit.mockResolvedValue({ allowed: true })
  mocks.deliver.mockResolvedValue({ setupToken: 'private-test-token' })
  mocks.audit.mockResolvedValue(undefined)
})

describe('self-service invitation resend safety', () => {
  it('uses safe token delivery without exposing the token in its response', async () => {
    const response = await POST(request())
    expect(await response.json()).toEqual({ sent: true })
    expect(mocks.deliver).toHaveBeenCalledWith(invitation, 'INVITATION.RESEND_REQUEST')
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'INVITATION.RESEND_REQUEST' }))
  })

  it('preserves the neutral response when safe delivery fails', async () => {
    mocks.deliver.mockRejectedValue(new Error('Email unavailable; previous token restored'))
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ sent: true })
    expect(mocks.audit).not.toHaveBeenCalled()
  })

  it('does not rotate links for accounts that have already registered', async () => {
    mocks.account.mockResolvedValue({ email: 'TEACHER@EXAMPLE.TEST' })
    expect(await (await POST(request())).json()).toEqual({ sent: true })
    expect(mocks.deliver).not.toHaveBeenCalled()
  })

  it('honors the resend cooldown without revealing invitation status', async () => {
    mocks.invitation.mockResolvedValue({ ...invitation, updatedAt: new Date() })
    expect(await (await POST(request())).json()).toEqual({ sent: true })
    expect(mocks.deliver).not.toHaveBeenCalled()
  })

  it('stops rate-limited requests before looking up an invitation', async () => {
    mocks.limit.mockResolvedValue({ allowed: false })
    expect(await (await POST(request())).json()).toEqual({ sent: true })
    expect(mocks.invitation).not.toHaveBeenCalled()
  })

  it('returns the same response for an unknown email', async () => {
    mocks.invitation.mockResolvedValue(null)
    expect(await (await POST(request())).json()).toEqual({ sent: true })
    expect(mocks.deliver).not.toHaveBeenCalled()
  })

  it('rejects an invalid email address', async () => {
    expect((await POST(request('invalid'))).status).toBe(400)
  })
})
