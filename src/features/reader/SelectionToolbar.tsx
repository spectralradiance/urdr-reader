import { Check, Copy, Quote as QuoteIcon, Send } from 'lucide-react'
import { useEffect, useState, type RefObject } from 'react'
import type { BookManifest } from '../../books/types.ts'
import { db, type Quote } from '../../db/db.ts'
import { blueskyIntentUrl, cleanQuoteText, quoteWithCitation, rangeToOffsets } from '../quotes/quotes.ts'

type Pending = { quote: Quote; rect: DOMRect }

const MAX_QUOTE_CHARS = 4000

/** Floating actions for a text selection in the reader: save as quote, copy, share. */
export function SelectionToolbar({
  contentRef,
  book,
  chapterIndex,
}: {
  contentRef: RefObject<HTMLElement | null>
  book: BookManifest
  chapterIndex: number
}) {
  const [pending, setPending] = useState<Pending | null>(null)
  const [done, setDone] = useState<'saved' | 'copied' | null>(null)

  useEffect(() => {
    let timer: number | undefined
    const read = () => {
      const content = contentRef.current
      const sel = window.getSelection()
      if (!content || !sel || sel.isCollapsed || sel.rangeCount === 0) return setPending(null)
      const range = sel.getRangeAt(0)
      if (!content.contains(range.commonAncestorContainer)) return setPending(null)
      const text = cleanQuoteText(sel.toString())
      const offsets = rangeToOffsets(content, range)
      if (text.length < 3 || text.length > MAX_QUOTE_CHARS || !offsets) return setPending(null)
      const chapter = book.chapters[chapterIndex]
      setDone(null)
      setPending({
        rect: range.getBoundingClientRect(),
        quote: {
          id: crypto.randomUUID(),
          bookId: book.id,
          bookTitle: book.title,
          authors: book.authors,
          ebookNo: book.source.ebookNo,
          chapterIndex,
          chapterTitle: chapter.title,
          text,
          ...offsets,
          createdAt: Date.now(),
        },
      })
    }
    const onChange = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(read, 200)
    }
    document.addEventListener('selectionchange', onChange)
    window.addEventListener('scroll', onChange, { passive: true })
    return () => {
      document.removeEventListener('selectionchange', onChange)
      window.removeEventListener('scroll', onChange)
      window.clearTimeout(timer)
    }
  }, [contentRef, book, chapterIndex])

  // Brief confirmation, then clear the selection.
  useEffect(() => {
    if (!done) return
    const t = window.setTimeout(() => {
      window.getSelection()?.removeAllRanges()
      setPending(null)
      setDone(null)
    }, 1200)
    return () => window.clearTimeout(t)
  }, [done])

  if (!pending) return null

  const { quote, rect } = pending
  const width = 300
  const left = Math.min(Math.max(8, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 8)
  // Above the selection when there's room (clear of the top bar), otherwise below it.
  const top = rect.top > 120 ? rect.top - 52 : Math.min(rect.bottom + 12, window.innerHeight - 120)

  const save = async () => {
    await db.quotes.put(quote)
    setDone('saved')
  }
  const copy = async () => {
    await navigator.clipboard.writeText(quoteWithCitation(quote))
    setDone('copied')
  }

  return (
    <div
      role="toolbar"
      aria-label="Selected text"
      className="fixed z-40 flex items-center gap-1 rounded-full border border-border bg-surface p-1 text-sm shadow-lg"
      style={{ top, left, width }}
      // Keep the selection alive while clicking the toolbar.
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => e.stopPropagation()}
    >
      {done ? (
        <span className="flex flex-1 items-center justify-center gap-2 py-1.5 text-accent">
          <Check className="size-4" aria-hidden /> {done === 'saved' ? 'Quote saved' : 'Copied with citation'}
        </span>
      ) : (
        <>
          <button type="button" onClick={save} className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-accent py-1.5 font-medium text-accent-fg">
            <QuoteIcon className="size-4" aria-hidden /> Save quote
          </button>
          <button type="button" onClick={copy} className="grid size-8 place-items-center rounded-full hover:bg-surface-2" aria-label="Copy with citation" title="Copy with citation">
            <Copy className="size-4" aria-hidden />
          </button>
          <a
            href={blueskyIntentUrl(quote)}
            target="_blank"
            rel="noreferrer"
            className="grid size-8 place-items-center rounded-full hover:bg-surface-2"
            aria-label="Share on Bluesky"
            title="Share on Bluesky (opens your composer)"
          >
            <Send className="size-4" aria-hidden />
          </a>
        </>
      )}
    </div>
  )
}
