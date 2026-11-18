import type { Invitation } from '@prisma/client'
import { headteacherSetupEmail, invitationResendEmail, sendEmail } from '@/lib/email'
import { createInvitationToken, invitationExpiry } from '@/lib/invitations'
import { prisma } from '@/lib/prisma'

type ResendableInvitation = Invitation & { school?: { name: string | null } | null }

export async function deliverInvitationResend(invitation: ResendableInvitation, emailType?: string) {
  const { rawToken, tokenHash } = createInvitationToken()
  const expiresAt = invitationExpiry()

  const originalFields = {
    tokenHash: invitation.tokenHash,
    expiresAt: invitation.expiresAt,
    status: invitation.status,
    updatedAt: invitation.updatedAt,
  }
  const rotatedFields = {
    tokenHash,
    expiresAt,
    status: 'PENDING' as const,
    updatedAt: new Date(),
  }

  // Reserve the cooldown while sending so simultaneous requests cannot rotate
  // the link twice. Explicitly restore updatedAt on failure: Prisma otherwise
  // advances @updatedAt even when only token/status fields are restored.
  const rotated = await prisma.invitation.updateMany({
    where: { id: invitation.id, ...originalFields },
    data: rotatedFields,
  })
  if (rotated.count !== 1) throw new Error('Invitation changed before resend')

  try {
    const email = invitation.role === 'HEADTEACHER'
      ? headteacherSetupEmail(invitation.name, invitation.school?.name ?? 'your school', rawToken)
      : invitationResendEmail(invitation.name, invitation.school?.name ?? 'your school', rawToken)
    await sendEmail({ to: invitation.email, ...email, ...(emailType ? { type: emailType } : {}) })
  } catch (error) {
    const restored = await prisma.invitation.updateMany({
      where: { id: invitation.id, ...rotatedFields },
      data: originalFields,
    })
    if (restored.count !== 1) {
      throw new Error(`Invitation resend failed and the original link could not be restored: ${error instanceof Error ? error.message : String(error)}`)
    }
    throw error
  }

  return { setupToken: rawToken, expiresAt }
}

export function resendFailureMessage(reason: string | undefined) {
  switch (reason) {
    case 'REVOKED': return 'This invitation was revoked and cannot be resent.'
    case 'ACCEPTED': return 'This invitation was already accepted.'
    case 'ACCOUNT_EXISTS': return 'An account already exists for this email address.'
    case 'COOLDOWN': return 'A new link was sent recently. Please wait an hour before resending.'
    case 'NOT_FOUND': return 'Invitation not found.'
    case 'DELIVERY_FAILED': return 'The new link could not be emailed.'
    case 'ELIGIBLE': return 'Sent.'
    default: return 'Unable to resend invitation.'
  }
}
