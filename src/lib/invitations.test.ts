import { describe, it, expect } from 'vitest'
import { createInvitationToken, hashInvitationToken } from '@/lib/invitations'

describe('createInvitationToken', () => {
  it('returns a raw token and a hash', () => {
    const result = createInvitationToken()
    expect(result).toHaveProperty('rawToken')
    expect(result).toHaveProperty('tokenHash')
    expect(typeof result.rawToken).toBe('string')
    expect(typeof result.tokenHash).toBe('string')
  })

  it('raw token is 64 hex characters (32 bytes)', () => {
    const { rawToken } = createInvitationToken()
    expect(rawToken).toMatch(/^[0-9a-f]{64}$/)
  })

  it('hash is 64 hex characters (SHA-256)', () => {
    const { tokenHash } = createInvitationToken()
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('generates unique tokens each call', () => {
    const t1 = createInvitationToken()
    const t2 = createInvitationToken()
    expect(t1.rawToken).not.toBe(t2.rawToken)
    expect(t1.tokenHash).not.toBe(t2.tokenHash)
  })

  it('tokenHash is a valid SHA-256 hash of rawToken', () => {
    const { rawToken, tokenHash } = createInvitationToken()
    const expectedHash = hashInvitationToken(rawToken)
    expect(tokenHash).toBe(expectedHash)
  })
})

describe('hashInvitationToken', () => {
  it('returns deterministic hash for same input', () => {
    const token = 'abc123def456'
    const h1 = hashInvitationToken(token)
    const h2 = hashInvitationToken(token)
    expect(h1).toBe(h2)
  })

  it('returns different hash for different input', () => {
    const h1 = hashInvitationToken('token-one')
    const h2 = hashInvitationToken('token-two')
    expect(h1).not.toBe(h2)
  })

  it('returns a 64-char hex string', () => {
    const hash = hashInvitationToken('any-token')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('handles empty string input', () => {
    const hash = hashInvitationToken('')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })
})