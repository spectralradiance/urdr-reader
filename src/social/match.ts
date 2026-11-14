// Is a post possibly about a book? Deliberately simple, and labelled "possibly related" in the UI.

import type { BookManifest } from '../books/types.ts'
import { shortTitle } from '../lib/format.ts'
import type { SocialItem } from './types.ts'

const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'vol', 'volume', 'book', 'books'])

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export function bookMatcher(book: Pick<BookManifest, 'title' | 'authors' | 'source'>) {
  const title = norm(shortTitle(book.title).replace(/,.*$/, ''))
  const titleWords = title.split(' ').filter((w) => !STOP.has(w))
  const surnames = book.authors.map((a) => norm(a.split(',')[0])).filter((s) => s.length > 2)
  const ebookLink = new RegExp(`gutenberg\\.org/(ebooks|cache/epub)/${book.source.ebookNo}\\b`)

  return (item: SocialItem): boolean => {
    if (item.links.some((l) => ebookLink.test(l))) return true
    const text = ` ${norm([item.title, item.text, item.embed?.title, item.embed?.description].filter(Boolean).join(' '))} `
    if (!text.includes(` ${title} `) && !text.includes(` ${titleWords.join(' ')} `)) return false
    // A one-word title ("Beowulf", "Iliad") is distinctive alone, as is a long title;
    // two-word titles need the author too.
    return (
      titleWords.length <= 1 ||
      titleWords.length >= 3 ||
      surnames.some((s) => text.includes(` ${s} `))
    )
  }
}
