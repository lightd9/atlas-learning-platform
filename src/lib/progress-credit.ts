export type WatchedRange = { start: number; end: number }

export type CreditInput = {
  duration: number
  previousRanges?: WatchedRange[]
  incomingRanges: WatchedRange[]
  elapsedSeconds?: number | null
  sessionToleranceSeconds?: number
  maxInitialCreditSeconds?: number
}

export function parseWatchedRanges(value: unknown): WatchedRange[] {
  let parsed: unknown = value
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value)
    } catch {
      return []
    }
  }
  if (!Array.isArray(parsed)) return []
  return parsed.filter(
    (range): range is WatchedRange =>
      Boolean(range) &&
      Number.isFinite((range as WatchedRange).start) &&
      Number.isFinite((range as WatchedRange).end),
  ).map((range) => ({ start: range.start, end: range.end }))
}

export function normalizeWatchedRanges(ranges: WatchedRange[], duration: number): WatchedRange[] {
  return ranges
    .map((range) => ({
      start: Math.max(0, Math.min(duration, Number(range.start))),
      end: Math.max(0, Math.min(duration, Number(range.end))),
    }))
    .filter((range) => Number.isFinite(range.start) && Number.isFinite(range.end) && range.end > range.start)
    .sort((a, b) => a.start - b.start)
}

function mergeRanges(ranges: WatchedRange[]): WatchedRange[] {
  const merged: WatchedRange[] = []
  for (const range of ranges) {
    const previous = merged[merged.length - 1]
    if (previous && range.start <= previous.end + 0.001) {
      previous.end = Math.max(previous.end, range.end)
    } else {
      merged.push({ ...range })
    }
  }
  return merged
}

function coveredLength(ranges: WatchedRange[]): number {
  return mergeRanges(ranges).reduce((total, range) => total + (range.end - range.start), 0)
}

function subtractRanges(source: WatchedRange[], subtract: WatchedRange[]): WatchedRange[] {
  const result: WatchedRange[] = []
  for (const range of source) {
    let pieces = [{ start: range.start, end: range.end }]
    for (const cut of subtract) {
      const next: WatchedRange[] = []
      for (const piece of pieces) {
        if (cut.end <= piece.start || cut.start >= piece.end) {
          next.push(piece)
          continue
        }
        if (cut.start > piece.start) next.push({ start: piece.start, end: cut.start })
        if (cut.end < piece.end) next.push({ start: cut.end, end: piece.end })
      }
      pieces = next
    }
    result.push(...pieces.filter((piece) => piece.end > piece.start))
  }
  return result.sort((a, b) => a.start - b.start)
}

export function creditWatchedRanges(input: CreditInput) {
  const {
    duration,
    previousRanges = [],
    incomingRanges,
    elapsedSeconds = null,
    sessionToleranceSeconds = 0,
    maxInitialCreditSeconds = 0,
  } = input

  const previous = mergeRanges(normalizeWatchedRanges(previousRanges, duration))
  const incoming = mergeRanges(normalizeWatchedRanges(incomingRanges, duration))
  const uncovered = subtractRanges(incoming, previous)
  const cap = elapsedSeconds == null
    ? maxInitialCreditSeconds
    : Math.max(0, elapsedSeconds) + sessionToleranceSeconds

  const creditedSegments: WatchedRange[] = []
  let remaining = Math.max(0, cap)
  for (const segment of uncovered) {
    if (remaining <= 0) break
    // New viewing must continue from the start or previously watched coverage.
    // An isolated range near the end is a seek, even if its length is small.
    const coverage = [...previous, ...creditedSegments]
    if (segment.start > 0.05 && !coverage.some((range) => segment.start >= range.start && segment.start <= range.end + 0.05)) continue
    const length = segment.end - segment.start
    const take = Math.min(length, remaining)
    creditedSegments.push({ start: segment.start, end: segment.start + take })
    remaining -= take
  }

  const ranges = mergeRanges(normalizeWatchedRanges([...previous, ...creditedSegments], duration))
  const watchedSeconds = coveredLength(ranges)
  const completed = duration > 0 && watchedSeconds >= duration * 0.95

  return { ranges, watchedSeconds, newCreditSeconds: coveredLength(creditedSegments), completed }
}

export function savedWatchedRanges(progress?: { watchedRanges?: unknown; watchedSeconds?: number; durationSeconds?: number } | null): WatchedRange[] {
  const ranges = parseWatchedRanges(progress?.watchedRanges)
  if (ranges.length) return ranges
  const watched = Math.max(0, progress?.watchedSeconds ?? 0)
  const duration = progress?.durationSeconds || watched
  return watched > 0 ? [{ start: 0, end: Math.min(watched, duration) }] : []
}

export function serializeLessonProgress<T extends { watchedRanges?: unknown; watchedSeconds?: number; durationSeconds?: number }>(progress: T) {
  return { ...progress, watchedRanges: savedWatchedRanges(progress) }
}

export function clampSeekTarget(target: number, ranges: WatchedRange[], duration: number): number {
  const requested = Number.isFinite(target) ? Math.max(0, Math.min(duration, target)) : 0
  let allowed = 0
  for (const range of mergeRanges(normalizeWatchedRanges(ranges, duration))) {
    if (requested >= range.start && requested <= range.end) return requested
    if (range.end <= requested) allowed = range.end
  }
  return allowed
}

export function calculateCourseProgressFromLessons(
  lessons: Array<{ durationSeconds: number; watchedSeconds: number }>,
) {
  const durationSeconds = lessons.reduce((total, lesson) => total + Math.max(0, lesson.durationSeconds), 0)
  const watchedSeconds = lessons.reduce(
    (total, lesson) => total + Math.min(Math.max(0, lesson.watchedSeconds), Math.max(0, lesson.durationSeconds)),
    0,
  )
  const percentComplete = durationSeconds > 0 ? Math.round((watchedSeconds / durationSeconds) * 100) : 0
  const completed = lessons.length > 0 && lessons.every(
    (lesson) => lesson.durationSeconds > 0 && lesson.watchedSeconds >= lesson.durationSeconds * 0.95,
  )

  return { durationSeconds, watchedSeconds, percentComplete, completed }
}
