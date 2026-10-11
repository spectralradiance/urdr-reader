// Reading position as a text anchor (top-level block index + character offset), so the same
// spot survives switching between scroll and paged modes, font changes and window resizes.

export type Anchor = { block: number; offset: number }

const textLength = (el: Element) => Math.max(1, (el.textContent ?? '').length)
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

// ---- Scroll mode (window scrolls) --------------------------------------------------------------

export function readScrollAnchor(content: HTMLElement, topInset: number): Anchor {
  const blocks = content.children
  for (let i = 0; i < blocks.length; i++) {
    const r = blocks[i].getBoundingClientRect()
    if (r.bottom > topInset) {
      const fraction = r.height > 0 ? clamp((topInset - r.top) / r.height, 0, 1) : 0
      return { block: i, offset: Math.round(fraction * textLength(blocks[i])) }
    }
  }
  return { block: Math.max(0, blocks.length - 1), offset: 0 }
}

export function scrollToAnchor(content: HTMLElement, anchor: Anchor, topInset: number) {
  const el = content.children[anchor.block]
  if (!el) return window.scrollTo({ top: 0, behavior: 'instant' })
  const r = el.getBoundingClientRect()
  const y = window.scrollY + r.top + (anchor.offset / textLength(el)) * r.height - topInset
  window.scrollTo({ top: Math.max(0, y), behavior: 'instant' })
}

export function scrollToElement(el: Element, topInset: number) {
  const y = window.scrollY + el.getBoundingClientRect().top - topInset
  window.scrollTo({ top: Math.max(0, y), behavior: 'instant' })
}

// ---- Paged mode (CSS columns, shifted with translateX inside a clipping viewport) -------------
// Column positions are measured from the content box's left edge, which moves with the transform.

/** First block on `page`. Measured relative to the content box, so it's correct mid-animation. */
export function readPagedAnchor(content: HTMLElement, page: number, step: number, width: number): Anchor {
  const origin = content.getBoundingClientRect().left
  const start = page * step
  const end = start + width
  const blocks = content.children
  for (let i = 0; i < blocks.length; i++) {
    const rects = [...blocks[i].getClientRects()]
    const visible = rects.findIndex((r) => r.right - origin > start + 1 && r.left - origin < end - 1 && r.height > 0)
    if (visible >= 0) return { block: i, offset: Math.round((visible / rects.length) * textLength(blocks[i])) }
  }
  return { block: 0, offset: 0 }
}

/** Which page (0-based) holds the anchor, given the distance between page starts. */
export function pageOfAnchor(content: HTMLElement, anchor: Anchor, step: number): number {
  const el = content.children[anchor.block]
  if (!el) return 0
  const rects = [...el.getClientRects()]
  if (rects.length === 0) return 0
  const i = Math.min(rects.length - 1, Math.floor((anchor.offset / textLength(el)) * rects.length))
  return pageOfRect(content, rects[i], step)
}

export function pageOfElement(content: HTMLElement, el: Element, step: number): number {
  return pageOfRect(content, el.getBoundingClientRect(), step)
}

/** Total pages: find the column holding the end of the last block. */
export function countPages(content: HTMLElement, columnStep: number, columnsPerPage: number): number {
  const last = content.lastElementChild
  const rects = last ? [...last.getClientRects()] : []
  if (rects.length === 0) return 1
  const left = rects[rects.length - 1].left - content.getBoundingClientRect().left
  const columns = Math.floor((left + 2) / columnStep) + 1
  return Math.max(1, Math.ceil(columns / columnsPerPage))
}

function pageOfRect(content: HTMLElement, rect: DOMRect, step: number): number {
  const left = rect.left - content.getBoundingClientRect().left
  return Math.max(0, Math.floor((left + 2) / step))
}
