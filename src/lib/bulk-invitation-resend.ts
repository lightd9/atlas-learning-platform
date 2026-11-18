import type { User } from '@prisma/client'
import { auditLog } from '@/lib/audit'
import { deliverInvitationResend, resendFailureMessage } from '@/lib/invitation-delivery'
import { evaluateInvitationResend, summarizeResendResults, type ResendResult } from '@/lib/invitation-resend'
import { INVITATION_RESEND_COOLDOWN_MS } from '@/lib/invitations'
import { prisma } from '@/lib/prisma'

export async function resendInvitationBatch(manager: Pick<User, 'id' | 'role' | 'schoolId'>, requestedIds: string[], schoolId?: string) {
  if (manager.role !== 'ATLAS_ADMIN' && (manager.role !== 'HEADTEACHER' || !manager.schoolId)) throw new Error('FORBIDDEN')
  if (manager.role !== 'ATLAS_ADMIN' && schoolId && schoolId !== manager.schoolId) throw new Error('FORBIDDEN')
  const scope = manager.role === 'ATLAS_ADMIN' ? schoolId : manager.schoolId
  const ids = [...new Set(requestedIds)]
  const invitations = await prisma.invitation.findMany({
    where: { id: { in: ids } },
    include: { school: { select: { name: true } } },
  })
  // Validate the whole selection before sending any email.
  if (scope && invitations.some((invitation) => invitation.schoolId !== scope)) throw new Error('FORBIDDEN')
  const accounts = invitations.length ? await prisma.user.findMany({
    where: { email: { in: invitations.map((invitation) => invitation.email), mode: 'insensitive' } },
    select: { email: true },
  }) : []
  const existingAccountEmails = new Set(accounts.map((account) => account.email))
  const byId = new Map(invitations.map((invitation) => [invitation.id, invitation]))
  const results: ResendResult[] = []
  const setupLinks: { invitationId: string; email: string; setupToken: string; expiresAt: string }[] = []

  for (const id of ids) {
    const invitation = byId.get(id)
    if (!invitation) {
      results.push({ id, email: '', status: 'FAILED', reason: 'NOT_FOUND' })
      continue
    }
    const evaluation = evaluateInvitationResend(invitation, {
      now: new Date(), existingAccountEmails, cooldownMs: INVITATION_RESEND_COOLDOWN_MS,
    })
    if (!evaluation.eligible) {
      results.push({ id, email: invitation.email, status: 'SKIPPED', reason: evaluation.reason })
      continue
    }
    try {
      const delivered = await deliverInvitationResend(invitation)
      results.push({ id, email: invitation.email, status: 'SENT' })
      setupLinks.push({ invitationId: id, email: invitation.email, setupToken: delivered.setupToken, expiresAt: delivered.expiresAt.toISOString() })
      await auditLog({ action: 'INVITATION.RESEND', userId: manager.id, schoolId: invitation.schoolId ?? undefined, details: `Invitation resent to ${invitation.email}` })
    } catch {
      results.push({ id, email: invitation.email, status: 'FAILED', reason: 'DELIVERY_FAILED' })
    }
  }
  return {
    results: results.map((result) => ({ ...result, message: result.status === 'SENT' ? 'Sent.' : resendFailureMessage(result.reason) })),
    summary: summarizeResendResults(results),
    setupLinks,
  }
}
