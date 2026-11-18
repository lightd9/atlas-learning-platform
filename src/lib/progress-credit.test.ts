import { describe, it, expect } from 'vitest'
import { calculateCourseProgressFromLessons, clampSeekTarget, creditWatchedRanges, normalizeWatchedRanges, savedWatchedRanges } from '@/lib/progress-credit'

describe('normalizeWatchedRanges', () => {
  it('clamps ranges to the authoritative duration and drops invalid ranges', () => {
    expect(normalizeWatchedRanges([
      { start: -10, end: 20 },
      { start: 80, end: 200 },
      { start: 50, end: 40 },
      { start: Number.NaN, end: 60 },
    ], 100)).toEqual([
      { start: 0, end: 20 },
      { start: 80, end: 100 },
    ])
  })
})

describe('creditWatchedRanges', () => {
  it('does not award viewing time before the first observed playback session', () => {
    expect(creditWatchedRanges({ duration: 20, incomingRanges: [{ start: 0, end: 20 }] }).watchedSeconds).toBe(0)
  })

  it('rejects a short disjoint range reached by skipping forward', () => {
    expect(creditWatchedRanges({ duration: 100, previousRanges: [{ start: 0, end: 10 }], incomingRanges: [{ start: 90, end: 100 }], elapsedSeconds: 10 }).watchedSeconds).toBe(10)
  })

  it('does not grant a new tolerance allowance for repeated requests at the same time', () => {
    const result = creditWatchedRanges({ duration: 100, previousRanges: [{ start: 0, end: 10 }], incomingRanges: [{ start: 0, end: 100 }], elapsedSeconds: 0 })
    expect(result.watchedSeconds).toBe(10)
  })

  it('does not spend the credit budget twice on overlapping ranges', () => {
    const result = creditWatchedRanges({ duration: 100, previousRanges: [{ start: 0, end: 10 }], incomingRanges: [{ start: 0, end: 15 }, { start: 10, end: 25 }], elapsedSeconds: 15 })
    expect(result.watchedSeconds).toBe(25)
    expect(result.newCreditSeconds).toBe(15)
  })
  it('does not credit a scrub to the end as watched time', () => {
    const result = creditWatchedRanges({
      duration: 100,
      incomingRanges: [{ start: 0, end: 100 }],
      elapsedSeconds: 1,
      sessionToleranceSeconds: 5,
    })
    expect(result.watchedSeconds).toBeLessThanOrEqual(6)
    expect(result.completed).toBe(false)
  })

  it('credits genuine sequential playback within the observed session window', () => {
    const result = creditWatchedRanges({
      duration: 100,
      previousRanges: [{ start: 0, end: 40 }],
      incomingRanges: [{ start: 40, end: 50 }],
      elapsedSeconds: 12,
      sessionToleranceSeconds: 5,
    })
    expect(result.watchedSeconds).toBe(50)
    expect(result.newCreditSeconds).toBe(10)
  })

  it('does not double-credit restored ranges from another device', () => {
    const result = creditWatchedRanges({
      duration: 100,
      previousRanges: [{ start: 0, end: 60 }],
      incomingRanges: [{ start: 0, end: 60 }],
      elapsedSeconds: 1,
      sessionToleranceSeconds: 5,
    })
    expect(result.watchedSeconds).toBe(60)
    expect(result.newCreditSeconds).toBe(0)
  })

  it('uses a conservative cap for the first observed session', () => {
    const result = creditWatchedRanges({
      duration: 600,
      incomingRanges: [{ start: 0, end: 600 }],
      elapsedSeconds: null,
      maxInitialCreditSeconds: 30,
    })
    expect(result.watchedSeconds).toBe(30)
  })

  it('ignores forged reversed and non-finite ranges', () => {
    const result = creditWatchedRanges({
      duration: 100,
      incomingRanges: [{ start: 90, end: 10 }, { start: Number.NaN, end: 80 }],
      elapsedSeconds: 60,
    })
    expect(result.watchedSeconds).toBe(0)
  })
})

describe('calculateCourseProgressFromLessons', () => {
  it('does not complete a lesson whose authoritative duration is not known', () => {
    expect(calculateCourseProgressFromLessons([{ durationSeconds: 0, watchedSeconds: 0 }]).completed).toBe(false)
  })
  it('derives course completion from authoritative lesson progress only', () => {
    const result = calculateCourseProgressFromLessons([
      { durationSeconds: 100, watchedSeconds: 100 },
      { durationSeconds: 100, watchedSeconds: 0 },
    ])
    expect(result.watchedSeconds).toBe(100)
    expect(result.durationSeconds).toBe(200)
    expect(result.percentComplete).toBe(50)
    expect(result.completed).toBe(false)
  })

  it('completes only when every authoritative lesson is nearly complete', () => {
    const result = calculateCourseProgressFromLessons([
      { durationSeconds: 100, watchedSeconds: 95 },
      { durationSeconds: 100, watchedSeconds: 100 },
    ])
    expect(result.percentComplete).toBe(98)
    expect(result.completed).toBe(true)
  })
})

describe('watched seeking and saved coverage', () => {
  const ranges = [{ start: 0, end: 20 }, { start: 40, end: 50 }]
  it('allows rewind and revisiting watched portions', () => {
    expect(clampSeekTarget(10, ranges, 100)).toBe(10)
    expect(clampSeekTarget(45, ranges, 100)).toBe(45)
  })
  it('blocks unwatched gaps and the unwatched end of the video', () => {
    expect(clampSeekTarget(30, ranges, 100)).toBe(20)
    expect(clampSeekTarget(90, ranges, 100)).toBe(50)
    expect(clampSeekTarget(100, [], 100)).toBe(0)
  })
  it('restores legacy credited progress without discarding it', () => {
    expect(savedWatchedRanges({ watchedRanges: '[]', watchedSeconds: 15, durationSeconds: 100 })).toEqual([{ start: 0, end: 15 }])
    expect(savedWatchedRanges({ watchedRanges: JSON.stringify(ranges), watchedSeconds: 30, durationSeconds: 100 })).toEqual(ranges)
  })
})
