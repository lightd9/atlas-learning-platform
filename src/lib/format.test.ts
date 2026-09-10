import { describe, it, expect } from 'vitest'
import { getCourseTone, formatDuration, formatTimestamp } from '@/lib/format'

describe('getCourseTone', () => {
  it('returns a tone from the palette', () => {
    const valid = ['blue', 'mint', 'lilac', 'peach', 'violet']
    for (let i = 0; i < 20; i++) {
      expect(valid).toContain(getCourseTone(i))
    }
  })

  it('cycles through tones', () => {
    expect(getCourseTone(0)).toBe('blue')
    expect(getCourseTone(1)).toBe('mint')
    expect(getCourseTone(5)).toBe('blue')
    expect(getCourseTone(6)).toBe('mint')
  })
})

describe('formatDuration', () => {
  it('formats minutes under 60', () => {
    expect(formatDuration(5)).toBe('5 min')
    expect(formatDuration(30)).toBe('30 min')
    expect(formatDuration(59)).toBe('59 min')
  })

  it('formats exact hours', () => {
    expect(formatDuration(60)).toBe('1h')
    expect(formatDuration(120)).toBe('2h')
    expect(formatDuration(180)).toBe('3h')
  })

  it('formats hours and minutes', () => {
    expect(formatDuration(90)).toBe('1h 30m')
    expect(formatDuration(75)).toBe('1h 15m')
    expect(formatDuration(150)).toBe('2h 30m')
  })

  it('handles zero', () => {
    expect(formatDuration(0)).toBe('0 min')
  })
})

describe('formatTimestamp', () => {
  it('returns placeholder for null', () => {
    expect(formatTimestamp(null)).toBe('—')
  })

  it('returns "Just now" for recent timestamps', () => {
    const now = new Date()
    expect(formatTimestamp(now)).toBe('Just now')
  })

  it('returns minutes ago', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
    expect(formatTimestamp(fiveMinAgo)).toBe('5m ago')
  })

  it('returns hours ago', () => {
    const twoHrAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
    expect(formatTimestamp(twoHrAgo)).toBe('2h ago')
  })

  it('returns "Yesterday" for 1 day ago', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    expect(formatTimestamp(yesterday)).toBe('Yesterday')
  })

  it('returns days ago for < 7 days', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    expect(formatTimestamp(threeDaysAgo)).toBe('3 days ago')
  })

  it('returns formatted date for older timestamps', () => {
    const oldDate = new Date('2024-01-15')
    const result = formatTimestamp(oldDate)
    expect(result).toMatch(/15 Jan/)
  })
})