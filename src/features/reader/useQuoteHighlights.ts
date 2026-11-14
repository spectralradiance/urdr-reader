import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, type RefObject } from 'react'
import { db } from '../../db/db.ts'
import { offsetsToRange } from '../quotes/quotes.ts'

const HIGHLIGHT = 'urdr-quote'

/**
 * Marks saved quotes in the current chapter using the CSS Custom Highlight API, which paints
 * ranges without touching the DOM, so block indexes and reading positions stay stable.
 * Browsers without the API simply show no highlight.
 */
export function useQuoteHighlights(
  contentRef: RefObject<HTMLElement | null>,
  bookId: string,
  chapterIndex: number,
  html: string,
) {
  const quotes = useLiveQuery(
    () => db.quotes.where('[bookId+chapterIndex]').equals([bookId, chapterIndex]).toArray(),
    [bookId, chapterIndex],
  )

  useEffect(() => {
    const content = contentRef.current
    if (!content || !html || typeof Highlight === 'undefined' || !CSS.highlights) return
    const ranges = (quotes ?? []).flatMap((q) => offsetsToRange(content, q) ?? [])
    CSS.highlights.set(HIGHLIGHT, new Highlight(...ranges))
    return () => {
      CSS.highlights.delete(HIGHLIGHT)
    }
  }, [contentRef, quotes, html])
}
