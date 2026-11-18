import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(path.resolve(process.cwd(), 'src/app/home.css'), 'utf8')

function cssBlocks(selector: string): string[] {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return css.match(new RegExp(`${escaped}\\s*\\{[^}]*\\}`, 'g')) ?? []
}

describe('public homepage course layout', () => {
  it('lays out recommendations in a wrapping grid instead of a clipped horizontal rail', () => {
    const blocks = cssBlocks('.atlas-recommendation-list')

    expect(blocks.length).toBeGreaterThan(0)
    expect(blocks.some((block) => /display:\s*grid/.test(block))).toBe(true)
    expect(blocks.some((block) => /grid-template-columns:\s*repeat\(auto-fill/.test(block))).toBe(true)
    expect(blocks.some((block) => /flex-wrap:\s*nowrap/.test(block))).toBe(false)
    expect(blocks.some((block) => /overflow-x:\s*auto/.test(block))).toBe(false)
  })

  it('lays out top courses in a wrapping grid instead of a fixed-width track', () => {
    const trackBlocks = cssBlocks('.atlas-course-track')
    const cardBlocks = cssBlocks('.atlas-course-marquee .atlas-course-card')

    expect(trackBlocks.some((block) => /display:\s*grid/.test(block))).toBe(true)
    expect(trackBlocks.some((block) => /grid-template-columns:\s*repeat\(auto-fill/.test(block))).toBe(true)
    expect(trackBlocks.some((block) => /width:\s*max-content/.test(block))).toBe(false)
    expect(cardBlocks.some((block) => /width:\s*(?:230|260|300)px/.test(block))).toBe(false)
  })

  it('keeps the unlock section responsive so every managed course remains visible', () => {
    const blocks = cssBlocks('.atlas-skill-grid')

    expect(blocks.some((block) => /display:\s*grid/.test(block))).toBe(true)
    expect(blocks.some((block) => /grid-template-columns/.test(block))).toBe(true)
  })
})
