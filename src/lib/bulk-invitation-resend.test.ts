import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), user: vi.fn(), accounts: vi.fn(), invitations: vi.fn(), invitation: vi.fn(),
  updateMany: vi.fn(), deliver: vi.fn(), audit: vi.fn(),
}))
vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/prisma', () => ({ prisma: {
  user: { findUnique: mocks.user, findMany: mocks.accounts },
  invitation: { findMany: mocks.invitations, findUnique: mocks.invitation, updateMany: mocks.updateMany },
} }))
vi.mock('@/lib/audit', () => ({ auditLog: mocks.audit }))
vi.mock('@/lib/invitation-delivery', async (original) => ({
  ...await original<typeof import('@/lib/invitation-delivery')>(), deliverInvitationResend: mocks.deliver,
}))

import { resendInvitationBatch } from '@/lib/bulk-invitation-resend'
import { POST } from '@/app/api/invitations/resend/route'
import { PATCH } from '@/app/api/invitations/[id]/route'

const manager = { id: 'headteacher', role: 'HEADTEACHER' as const, schoolId: 'school-a' }
const invitation = (id: string, overrides = {}) => ({
  id, email: `${id}@example.test`, name: id, role: 'TEACHER', schoolId: 'school-a',
  status: 'PENDING', tokenHash: `hash-${id}`, school: { name: 'School A' },
  createdAt: new Date('2020-01-01'), updatedAt: new Date('2020-01-01'), expiresAt: new Date('2099-01-01'),
  ...overrides,
})

beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth.mockResolvedValue({ user: { id: manager.id } })
  mocks.user.mockResolvedValue({ ...manager, status: 'ACTIVE' })
  mocks.accounts.mockResolvedValue([])
  mocks.invitations.mockResolvedValue([invitation('one'), invitation('two')])
  mocks.invitation.mockResolvedValue(invitation('one'))
  mocks.updateMany.mockResolvedValue({ count: 1 })
  mocks.deliver.mockResolvedValue({ setupToken: 'new-test-token', expiresAt: new Date('2099-01-01') })
  mocks.audit.mockResolvedValue(undefined)
})

describe('bulk invitation delivery', () => {
  it('resends each selected invitation once and audits successful delivery', async () => {
    const result = await resendInvitationBatch(manager, ['one', 'one', 'two'])
    expect(result.summary).toEqual({ total: 2, sent: 2, skipped: 0, failed: 0 })
    expect(mocks.deliver).toHaveBeenCalledTimes(2)
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'INVITATION.RESEND', userId: manager.id, schoolId: 'school-a' }))
  })

  it('rejects a mixed-school selection before any emails are sent', async () => {
    mocks.invitations.mockResolvedValue([invitation('one'), invitation('two', { schoolId: 'school-b' })])
    await expect(resendInvitationBatch(manager, ['one', 'two'])).rejects.toThrow('FORBIDDEN')
    expect(mocks.deliver).not.toHaveBeenCalled()
  })

  it('rejects a headteacher supplying another school’s ID', async () => {
    await expect(resendInvitationBatch(manager, ['one'], 'school-b')).rejects.toThrow('FORBIDDEN')
    expect(mocks.invitations).not.toHaveBeenCalled()
  })

  it('allows Atlas Admins to resend across schools', async () => {
    mocks.invitations.mockResolvedValue([invitation('one'), invitation('two', { schoolId: 'school-b' })])
    const result = await resendInvitationBatch({ id: 'admin', role: 'ATLAS_ADMIN', schoolId: null }, ['one', 'two'])
    expect(result.summary.sent).toBe(2)
  })

  it('continues after an email failure and reports partial success accurately', async () => {
    mocks.deliver.mockRejectedValueOnce(new Error('Email unavailable'))
    const result = await resendInvitationBatch(manager, ['one', 'two', 'missing'])
    expect(result.summary).toEqual({ total: 3, sent: 1, skipped: 0, failed: 2 })
    expect(result.results.map(({ status, reason }) => ({ status, reason }))).toEqual([
      { status: 'FAILED', reason: 'DELIVERY_FAILED' }, { status: 'SENT', reason: undefined },
      { status: 'FAILED', reason: 'NOT_FOUND' },
    ])
    expect(result.setupLinks.map((link) => link.invitationId)).toEqual(['two'])
    expect(mocks.audit).toHaveBeenCalledTimes(1)
  })

  it('skips existing accounts case-insensitively', async () => {
    mocks.accounts.mockResolvedValue([{ email: 'ONE@EXAMPLE.TEST' }])
    const result = await resendInvitationBatch(manager, ['one'])
    expect(result.results[0]).toMatchObject({ status: 'SKIPPED', reason: 'ACCOUNT_EXISTS' })
    expect(mocks.deliver).not.toHaveBeenCalled()
  })

  it.each([
    [{ status: 'ACCEPTED' }, 'ACCEPTED'], [{ status: 'REVOKED' }, 'REVOKED'],
    [{ updatedAt: new Date() }, 'COOLDOWN'],
  ])('skips invitations that cannot be resent', async (overrides, reason) => {
    mocks.invitations.mockResolvedValue([invitation('one', overrides)])
    const result = await resendInvitationBatch(manager, ['one'])
    expect(result.results[0]).toMatchObject({ status: 'SKIPPED', reason })
    expect(mocks.deliver).not.toHaveBeenCalled()
  })
})

describe('invitation route authorization and revocation', () => {
  const request = () => new Request('http://localhost/api/invitations/resend', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: ['one', 'two'] }),
  })
  const params = { params: Promise.resolve({ id: 'one' }) }

  it('returns 401 for an absent session', async () => {
    mocks.auth.mockResolvedValue(null)
    expect((await POST(request())).status).toBe(401)
  })

  it('denies teachers access to bulk resend', async () => {
    mocks.user.mockResolvedValue({ ...manager, role: 'TEACHER', status: 'ACTIVE' })
    expect((await POST(request())).status).toBe(403)
    expect(mocks.deliver).not.toHaveBeenCalled()
  })

  it('returns 403 for a mixed-school batch without delivering any invitations', async () => {
    mocks.invitations.mockResolvedValue([invitation('one'), invitation('two', { schoolId: 'school-b' })])
    expect((await POST(request())).status).toBe(403)
    expect(mocks.deliver).not.toHaveBeenCalled()
  })

  it('returns 409 when an invitation changes during revocation', async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 })
    expect((await PATCH(request(), params)).status).toBe(409)
    expect(mocks.audit).not.toHaveBeenCalled()
  })

  it('preserves revoked invitation records', async () => {
    expect((await PATCH(request(), params)).status).toBe(200)
    expect(mocks.updateMany).toHaveBeenCalledWith({ where: { id: 'one', status: { in: ['PENDING', 'EXPIRED'] } }, data: { status: 'REVOKED' } })
  })
})
