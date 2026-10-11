import DOMPurify from 'dompurify'
import { bookUrl } from '../../books/hosted.ts'

// External links open in a new tab; internal ones (#id) are handled by the reader.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && /^https?:/i.test(node.getAttribute('href') ?? '')) {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noreferrer')
  }
})

/** Sanitize chapter HTML and point relative image paths at the hosted book folder. */
export function prepareChapter(bookId: string, html: string): string {
  const clean = DOMPurify.sanitize(html, { ADD_ATTR: ['target'] })
  return clean.replace(/(<img\b[^>]*\bsrc=")images\//g, `$1${bookUrl(bookId, 'images/')}`)
}
