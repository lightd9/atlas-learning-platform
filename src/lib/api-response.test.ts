import { describe, expect, it } from 'vitest'
import { apiErrorMessage } from '@/lib/api-response'

describe('apiErrorMessage', () => {
  it.each([
    [401, 'Your session has expired. Please sign in again.'],
    [403, 'You do not have access to this course.'],
    [404, 'Course not found.'],
  ])('maps status %s to a specific learner message', (status, expected) => {
    expect(apiErrorMessage(status, 'Generic server error', 'Unable to load course.')).toBe(expected)
  })

  it('preserves a diagnostic server error for unexpected failures', () => {
    expect(apiErrorMessage(500, 'Database connection failed', 'Unable to load course.')).toBe('Database connection failed')
  })

  it('uses the fallback when no server error is available', () => {
    expect(apiErrorMessage(500, undefined, 'Unable to load course.')).toBe('Unable to load course.')
  })
})
