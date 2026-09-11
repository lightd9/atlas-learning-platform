import { createHash, randomBytes } from 'node:crypto'

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000

export const INVITATION_RESEND_COOLDOWN_MS = 60 * 60 * 1000

export function invitationExpiry() {
  return new Date(Date.now() + INVITATION_TTL_MS)
}

export function createInvitationToken() {
  const rawToken = randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')
  return { rawToken, tokenHash }
}

export function hashInvitationToken(rawToken: string) {
  return createHash('sha256').update(rawToken).digest('hex')
}
