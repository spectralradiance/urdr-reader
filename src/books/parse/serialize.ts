// Serializes parsed (X)HTML back to HTML-safe markup with an element/attribute allowlist.
// Writing our own avoids XML-isms like `<a id="x"/>` that break when re-parsed as HTML.

const VOID = new Set(['br', 'hr', 'img', 'col', 'wbr'])
const DROP = new Set([
  'script',
  'style',
  'link',
  'meta',
  'head',
  'title',
  'svg',
  'math',
  'object',
  'embed',
  'iframe',
  'form',
  'input',
  'button',
  'select',
  'textarea',
  'audio',
  'video',
  'canvas',
])
const ATTRS = new Set([
  'id',
  'class',
  'href',
  'src',
  'alt',
  'title',
  'lang',
  'dir',
  'colspan',
  'rowspan',
  'start',
  'width',
  'height',
  'cite',
])

export function serializeNode(node: Node): string {
  if (node.nodeType === 3) return escapeText(node.textContent ?? '')
  if (node.nodeType !== 1) return ''
  const el = node as Element
  const tag = el.localName.toLowerCase()
  if (DROP.has(tag)) return ''
  if (tag === 'body' || tag === 'html' || tag.includes(':')) return serializeChildren(el)

  let attrs = ''
  for (const attr of Array.from(el.attributes)) {
    let name = attr.name.toLowerCase()
    if (name === 'xml:lang') name = 'lang'
    if (!ATTRS.has(name)) continue
    if ((name === 'href' || name === 'src') && /^\s*(javascript|data|vbscript):/i.test(attr.value))
      continue
    attrs += ` ${name}="${escapeAttr(attr.value)}"`
  }
  if (VOID.has(tag)) return `<${tag}${attrs}>`
  return `<${tag}${attrs}>${serializeChildren(el)}</${tag}>`
}

export function serializeChildren(el: Element): string {
  return [...el.childNodes].map(serializeNode).join('')
}

export function textWords(node: Node): number {
  const text = (node.textContent ?? '').trim()
  return text ? text.split(/\s+/).length : 0
}

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, '&quot;')
}
