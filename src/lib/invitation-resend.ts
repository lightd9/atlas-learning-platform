export type InvitationStatus = 'PENDING' | 'EXPIRED' | 'ACCEPTED' | 'REVOKED'

export type ResendInvitation = {
  id: string
  email: string
  status: InvitationStatus
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
}

export type ResendContext = {
  now: Date
  existingAccountEmails: Set<string>
  cooldownMs: number
}

export type ResendEligibility = {
  eligible: boolean
  reason: 'ELIGIBLE' | 'REVOKED' | 'ACCEPTED' | 'ACCOUNT_EXISTS' | 'COOLDOWN'
  effectiveStatus: InvitationStatus
}

export type ResendResult = {
  id: string
  email: string
  status: 'SENT' | 'SKIPPED' | 'FAILED'
  reason?: string
}

export function effectiveInvitationStatus(
  invitation: Pick<ResendInvitation, 'status' | 'expiresAt'>,
  now: Date,
): InvitationStatus {
  if (invitation.status === 'ACCEPTED' || invitation.status === 'REVOKED') return invitation.status
  return now.getTime() > invitation.expiresAt.getTime() ? 'EXPIRED' : 'PENDING'
}

export function evaluateInvitationResend(invitation: ResendInvitation, context: ResendContext): ResendEligibility {
  const effectiveStatus = effectiveInvitationStatus(invitation, context.now)

  if (effectiveStatus === 'REVOKED') return { eligible: false, reason: 'REVOKED', effectiveStatus }
  if (effectiveStatus === 'ACCEPTED') return { eligible: false, reason: 'ACCEPTED', effectiveStatus }

  const normalizedEmail = invitation.email.trim().toLowerCase()
  if ([...context.existingAccountEmails].some((email) => email.trim().toLowerCase() === normalizedEmail)) {
    return { eligible: false, reason: 'ACCOUNT_EXISTS', effectiveStatus }
  }

  if (context.now.getTime() - invitation.updatedAt.getTime() < context.cooldownMs) {
    return { eligible: false, reason: 'COOLDOWN', effectiveStatus }
  }

  return { eligible: true, reason: 'ELIGIBLE', effectiveStatus }
}

export function summarizeResendResults(results: ResendResult[]) {
  return {
    total: results.length,
    sent: results.filter((result) => result.status === 'SENT').length,
    skipped: results.filter((result) => result.status === 'SKIPPED').length,
    failed: results.filter((result) => result.status === 'FAILED').length,
  }
}
