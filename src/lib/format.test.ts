import { describe, expect, it } from 'vitest'
import { authorName, displayHeading, readingTime, shortTitle, subtitle } from './format.ts'

describe('shortTitle and subtitle', () => {
  it('split a Gutenberg title at the slash', () => {
    const title = 'The Odyssey / Rendered into English prose'
    expect(shortTitle(title)).toBe('The Odyssey')
    expect(subtitle(title)).toBe('Rendered into English prose')
  })

  it('cut at a semicolon too', () => {
    expect(shortTitle('Beowulf; An Anglo-Saxon Epic Poem')).toBe('Beowulf')
  })

  it('leave a plain title alone', () => {
    expect(shortTitle('Beowulf')).toBe('Beowulf')
    expect(subtitle('Beowulf')).toBeUndefined()
  })
})

describe('displayHeading', () => {
  it('turns an all-caps heading into title case', () => {
    expect(displayHeading('BOOK I.')).toBe('Book I')
    expect(displayHeading('THE ODYSSEY')).toBe('The Odyssey')
  })

  it('keeps Roman numerals in capitals', () => {
    expect(displayHeading('CANTO XXIV')).toBe('Canto XXIV')
  })

  it('lowercases short words except at the start', () => {
    expect(displayHeading('THE FALL OF TROY')).toBe('The Fall of Troy')
  })

  it('leaves mixed-case headings alone', () => {
    expect(displayHeading('The Wrath of Achilles')).toBe('The Wrath of Achilles')
  })
})

describe('authorName', () => {
  it('reorders "Last, First"', () => {
    expect(authorName('Butler, Samuel')).toBe('Samuel Butler')
  })

  it('leaves single names and dates alone', () => {
    expect(authorName('Homer')).toBe('Homer')
    expect(authorName('Anonymous, 1100-1200')).toBe('Anonymous, 1100-1200')
  })
})

describe('readingTime', () => {
  it('rounds to at least a minute', () => {
    expect(readingTime(10)).toBe('1 min')
  })

  it('shows hours and minutes', () => {
    expect(readingTime(230 * 90)).toBe('1 h 30 min')
    expect(readingTime(230 * 120)).toBe('2 h')
  })
})
