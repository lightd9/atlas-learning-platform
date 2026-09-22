import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SESSION_MAX_AGE,
  SESSION_WITHOUT_REMEMBER_MAX_AGE,
  sessionMaxAge,
} from './session'

describe('sessionMaxAge', () => {
  it('keeps the configured lifetime when remember is enabled', () => {
    expect(sessionMaxAge(true, 60 * 60 * 24 * 30)).toBe(60 * 60 * 24 * 30)
  })

  it('falls back to the default lifetime when remember is undefined', () => {
    expect(sessionMaxAge(undefined, 0)).toBe(DEFAULT_SESSION_MAX_AGE)
    expect(sessionMaxAge(undefined, 60 * 60 * 24 * 30)).toBe(60 * 60 * 24 * 30)
  })

  it('shortens the lifetime when remember is disabled', () => {
    expect(sessionMaxAge(false, DEFAULT_SESSION_MAX_AGE)).toBe(SESSION_WITHOUT_REMEMBER_MAX_AGE)
  })
})