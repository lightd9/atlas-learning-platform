'use client'

interface DurationInputProps {
  totalSeconds: number
  onChange: (totalSeconds: number) => void
  ariaLabel?: string
  compact?: boolean
}

export default function DurationInput({ totalSeconds, onChange, ariaLabel = 'Duration in minutes and seconds', compact = false }: DurationInputProps) {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.max(0, Math.floor(totalSeconds)) : 0
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60

  function parseMinutes(value: string): number {
    const n = Number(value)
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  }

  function parseSeconds(value: string): number {
    const n = Number(value)
    if (!Number.isFinite(n)) return 0
    return Math.max(0, Math.min(59, Math.floor(n)))
  }

  return (
    <div className={`duration-input${compact ? ' duration-input-compact' : ''}`} role="group" aria-label={ariaLabel}>
      <div className="duration-field">
        <input
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          aria-label="Minutes"
          value={safe > 0 ? String(minutes) : ''}
          onChange={(e) => onChange(parseMinutes(e.target.value) * 60 + seconds)}
          placeholder="0"
        />
        <span className="duration-unit">min</span>
      </div>
      <span className="duration-colon" aria-hidden="true">:</span>
      <div className="duration-field">
        <input
          type="number"
          min="0"
          max="59"
          step="1"
          inputMode="numeric"
          aria-label="Seconds"
          value={seconds > 0 ? String(seconds) : ''}
          onChange={(e) => onChange(minutes * 60 + parseSeconds(e.target.value))}
          placeholder="00"
        />
        <span className="duration-unit">sec</span>
      </div>
    </div>
  )
}