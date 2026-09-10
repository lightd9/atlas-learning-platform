import { describe, expect, it } from 'vitest'
import { normalizeCsvHeader, parseCsv } from '@/lib/csv'

describe('CSV parsing', () => {
  it('supports quoted commas and escaped quotes', () => {
    expect(parseCsv('name,email\n"Smith, Jane",jane@example.com\n"O""Neil, Sam",sam@example.com')).toEqual([
      ['name', 'email'],
      ['Smith, Jane', 'jane@example.com'],
      ['O"Neil, Sam', 'sam@example.com'],
    ])
  })

  it('normalizes common header styles', () => {
    expect(normalizeCsvHeader('First Name')).toBe('firstname')
    expect(normalizeCsvHeader('last_name')).toBe('lastname')
  })
})
