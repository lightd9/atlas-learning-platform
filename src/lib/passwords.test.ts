import { describe, expect, it } from 'vitest'
import { generateTemporaryPassword } from './passwords'

describe('generateTemporaryPassword', () => {
  it('produces the requested length', () => {
    expect(generateTemporaryPassword(12)).toHaveLength(12)
    expect(generateTemporaryPassword(16)).toHaveLength(16)
    expect(generateTemporaryPassword()).toHaveLength(12)
  })

  it('only uses safe unambiguous characters', () => {
    expect(generateTemporaryPassword(64)).toMatch(/^[A-Za-z0-9]+$/)
  })

  it('generates distinct values', () => {
    const values = new Set(Array.from({ length: 200 }, () => generateTemporaryPassword(12)))
    expect(values.size).toBe(200)
  })
})