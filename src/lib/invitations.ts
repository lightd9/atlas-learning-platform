import { createHash, randomBytes } from 'node:crypto'

const configuredInvitationTtlDays = Number(process.env.INVITATION_TTL_DAYS ?? 30)

export const INVITATION_TTL_DAYS = Number.isSafeInteger(configuredInvitationTtlDays) && configuredInvitationTtlDays >= 1 && configuredInvitationTtlDays <= 365
  ? configuredInvitationTtlDays
  : 30

export const INVITATION_TTL_MS = INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000

export const INVITATION_RESEND_COOLDOWN_MS = 60 * 60 * 1000

export function invitationExpiry() {
  return new Date(Date.now() + INVITATION_TTL_MS)
}

export function invitationExpiryText() {
  return `${INVITATION_TTL_DAYS} day${INVITATION_TTL_DAYS === 1 ? '' : 's'}`
}

export function createInvitationToken() {
  const rawToken = randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')
  return { rawToken, tokenHash }
}

export function hashInvitationToken(rawToken: string) {
  return createHash('sha256').update(rawToken).digest('hex')
}
