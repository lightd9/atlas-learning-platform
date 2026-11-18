import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  updateMany: vi.fn(),
  sendEmail: vi.fn(),
  createInvitationToken: vi.fn(),
  invitationExpiry: vi.fn(),
  headteacherSetupEmail: vi.fn(),
  invitationResendEmail: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: { invitation: { updateMany: mocks.updateMany } },
}))

vi.mock('@/lib/email', () => ({
  sendEmail: mocks.sendEmail,
  headteacherSetupEmail: mocks.headteacherSetupEmail,
  invitationResendEmail: mocks.invitationResendEmail,
}))

vi.mock('@/lib/invitations', () => ({
  createInvitationToken: mocks.createInvitationToken,
  invitationExpiry: mocks.invitationExpiry,
}))

import { deliverInvitationResend } from '@/lib/invitation-delivery'

const originalExpiry = new Date('2026-11-16T12:00:00.000Z')
const originalUpdatedAt = new Date('2026-10-01T12:00:00.000Z')
const newExpiry = new Date('2026-12-17T12:00:00.000Z')
const resendAt = new Date('2026-11-17T12:00:00.000Z')

const invitation = {
  id: 'invite-1',
  email: 'teacher@example.com',
  name: 'Teacher',
  role: 'TEACHER',
  tokenHash: 'old-hash',
  expiresAt: originalExpiry,
  status: 'EXPIRED',
  updatedAt: originalUpdatedAt,
  school: { id: 'school-1', name: 'Atlas School' },
} as never

const originalWhere = {
  id: 'invite-1',
  tokenHash: 'old-hash',
  expiresAt: originalExpiry,
  status: 'EXPIRED',
  updatedAt: originalUpdatedAt,
}
const rotatedWhere = {
  id: 'invite-1',
  tokenHash: 'new-hash',
  expiresAt: newExpiry,
  status: 'PENDING',
  updatedAt: resendAt,
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(resendAt)
  vi.clearAllMocks()
  mocks.createInvitationToken.mockReturnValue({ rawToken: 'raw-new-token', tokenHash: 'new-hash' })
  mocks.invitationExpiry.mockReturnValue(newExpiry)
  mocks.invitationResendEmail.mockReturnValue({ subject: 'Reset link', html: '<p>Reset link</p>', text: 'Reset link' })
  mocks.headteacherSetupEmail.mockReturnValue({ subject: 'Setup link', html: '<p>Setup link</p>', text: 'Setup link' })
  mocks.sendEmail.mockResolvedValue(undefined)
  mocks.updateMany.mockResolvedValue({ count: 1 })
})
afterEach(() => vi.useRealTimers())

describe('deliverInvitationResend', () => {
  it('reserves the resend cooldown while the new link is being delivered', async () => {
    const result = await deliverInvitationResend(invitation)

    expect(mocks.updateMany).toHaveBeenNthCalledWith(1, {
      where: originalWhere,
      data: { tokenHash: 'new-hash', expiresAt: newExpiry, status: 'PENDING', updatedAt: resendAt },
    })
    expect(mocks.sendEmail).toHaveBeenCalledWith({
      to: 'teacher@example.com',
      subject: 'Reset link',
      html: '<p>Reset link</p>',
      text: 'Reset link',
    })
    expect(mocks.updateMany).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ setupToken: 'raw-new-token', expiresAt: newExpiry })
  })

  it('restores the original link and leaves the cooldown unchanged when delivery fails', async () => {
    mocks.sendEmail.mockRejectedValue(new Error('SMTP down'))

    await expect(deliverInvitationResend(invitation)).rejects.toThrow('SMTP down')

    expect(mocks.updateMany).toHaveBeenCalledTimes(2)
    expect(mocks.updateMany.mock.calls[0][0].data.updatedAt).toEqual(resendAt)
    expect(mocks.updateMany).toHaveBeenNthCalledWith(2, {
      where: rotatedWhere,
      data: {
        tokenHash: 'old-hash',
        expiresAt: originalExpiry,
        status: 'EXPIRED',
        updatedAt: originalUpdatedAt,
      },
    })
    expect(mocks.updateMany.mock.calls[1][0].data.updatedAt).toEqual(originalUpdatedAt)
  })

  it('does not send an email when another change invalidates the rotation', async () => {
    mocks.updateMany.mockResolvedValueOnce({ count: 0 })

    await expect(deliverInvitationResend(invitation)).rejects.toThrow('Invitation changed before resend')
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it('reports when a failed delivery cannot restore the original link', async () => {
    mocks.sendEmail.mockRejectedValue(new Error('SMTP down'))
    mocks.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 })

    await expect(deliverInvitationResend(invitation)).rejects.toThrow(/original link could not be restored/)
  })
})
