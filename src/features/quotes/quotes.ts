import type { Quote } from '../../db/db.ts'
import { authorName, displayHeading, shortTitle } from '../../lib/format.ts'

// ---- Mapping DOM selections <-> stored offsets ------------------------------------------------
// Offsets count characters of textContent within a top-level block of `.reader-content`,
// the same blocks reading positions use, so they're stable across layouts and modes.

type Point = { block: number; offset: number }

function topLevelBlock(content: HTMLElement, node: Node): Element | null {
  let n: Node | null = node
  while (n && n.parentNode !== content) n = n.parentNode
  return n && n.nodeType === Node.ELEMENT_NODE ? (n as Element) : null
}

function pointOf(content: HTMLElement, node: Node, offset: number): Point | null {
  const block = topLevelBlock(content, node)
  if (!block) return null
  const r = document.createRange()
  r.setStart(block, 0)
  r.setEnd(node, offset)
  return { block: Array.prototype.indexOf.call(content.children, block), offset: r.toString().length }
}

/** Offsets for a selection range inside the reader content, or null if it's outside it. */
export function rangeToOffsets(content: HTMLElement, range: Range): { start: Point; end: Point } | null {
  const start = pointOf(content, range.startContainer, range.startOffset)
  const end = pointOf(content, range.endContainer, range.endOffset)
  return start && end ? { start, end } : null
}

function domPoint(content: HTMLElement, p: Point): { node: Node; offset: number } | null {
  const block = content.children[p.block]
  if (!block) return null
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
  let remaining = p.offset
  let last: Text | null = null
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    if (remaining <= n.data.length) return { node: n, offset: remaining }
    remaining -= n.data.length
    last = n
  }
  return last ? { node: last, offset: last.data.length } : { node: block, offset: 0 }
}

export function offsetsToRange(content: HTMLElement, q: Pick<Quote, 'start' | 'end'>): Range | null {
  const s = domPoint(content, q.start)
  const e = domPoint(content, q.end)
  if (!s || !e) return null
  const r = document.createRange()
  try {
    r.setStart(s.node, s.offset)
    r.setEnd(e.node, e.offset)
  } catch {
    return null
  }
  return r
}

/** Selection text with layout whitespace tidied; keeps line breaks (poetry). */
export function cleanQuoteText(text: string): string {
  return text
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ---- Citations and sharing ------------------------------------------------------------------

export function citation(q: Pick<Quote, 'authors' | 'bookTitle' | 'chapterTitle'>): string {
  const author = q.authors.map(authorName).join(', ')
  return [author, shortTitle(q.bookTitle), displayHeading(q.chapterTitle)].filter(Boolean).join(', ')
}

export function quoteWithCitation(q: Quote): string {
  return `“${q.text}”\n— ${citation(q)} (Project Gutenberg #${q.ebookNo})`
}

const BLUESKY_LIMIT = 300

/** Bluesky's compose intent: opens the user's own composer with the text prefilled. */
export function blueskyIntentUrl(q: Quote): string {
  const tail = `\n— ${citation(q)}`
  const room = BLUESKY_LIMIT - tail.length - 2
  const chars = [...q.text]
  const body = chars.length > room ? `${chars.slice(0, room - 1).join('').trimEnd()}…` : q.text
  return `https://bsky.app/intent/compose?text=${encodeURIComponent(`“${body}”${tail}`)}`
}

export function quotesToMarkdown(quotes: Quote[]): string {
  const byBook = new Map<string, Quote[]>()
  for (const q of quotes) byBook.set(q.bookId, [...(byBook.get(q.bookId) ?? []), q])
  const sections = [...byBook.values()].map((qs) => {
    const first = qs[0]
    const header = `## ${shortTitle(first.bookTitle)}\n\n${first.authors.map(authorName).join(', ')} · https://www.gutenberg.org/ebooks/${first.ebookNo}`
    const items = qs
      .sort((a, b) => a.chapterIndex - b.chapterIndex || a.start.block - b.start.block)
      .map((q) => {
        const lines = [`> ${q.text.replace(/\n/g, '\n> ')}`, `> — ${displayHeading(q.chapterTitle)}`]
        if (q.note) lines.push('', q.note)
        return lines.join('\n')
      })
    return [header, ...items].join('\n\n')
  })
  return `# Quotes from Echtra\n\nExported ${new Date().toISOString().slice(0, 10)}. Texts from Project Gutenberg, public domain in the USA.\n\n${sections.join('\n\n---\n\n')}\n`
}
