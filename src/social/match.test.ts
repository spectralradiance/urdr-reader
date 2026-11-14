import { describe, expect, it } from 'vitest'
import { bookMatcher } from './match.ts'
import type { SocialItem } from './types.ts'

const source = { name: 'Project Gutenberg', ebookNo: 26, url: '', processed: '' } as const

function post(text: string, extra: Partial<SocialItem> = {}): SocialItem {
  return {
    id: text,
    source: 'bluesky',
    author: { name: 'A reader', handle: 'reader.example', url: '' },
    text,
    url: '',
    createdAt: '2026-11-14T00:00:00Z',
    links: [],
    ...extra,
  }
}

describe('bookMatcher', () => {
  const beowulf = bookMatcher({ title: 'Beowulf', authors: ['Anonymous'], source })
  const paradiseLost = bookMatcher({ title: 'Paradise Lost', authors: ['Milton, John'], source })

  it('matches a one-word title on its own', () => {
    expect(beowulf(post('Finally reading Beowulf this week'))).toBe(true)
  })

  it('ignores case and accents', () => {
    expect(beowulf(post('BÉOWULF is wild'))).toBe(true)
  })

  it('needs the author for a two-word title', () => {
    expect(paradiseLost(post('Paradise Lost is on my list'))).toBe(false)
    expect(paradiseLost(post('Milton wrote Paradise Lost blind'))).toBe(true)
  })

  it('matches a link to the Gutenberg ebook', () => {
    const linked = post('Look at this', { links: ['https://www.gutenberg.org/ebooks/26'] })
    expect(paradiseLost(linked)).toBe(true)
  })

  it('does not match a title inside another word', () => {
    expect(beowulf(post('Beowulfian vibes'))).toBe(false)
  })
})
