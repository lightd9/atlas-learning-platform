import { createHash, randomBytes } from 'node:crypto'

export function createInvitationToken() {
  const rawToken = randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')
  return { rawToken, tokenHash }
}

export function hashInvitationToken(rawToken: string) {
  return createHash('sha256').update(rawToken).digest('hex')
}
