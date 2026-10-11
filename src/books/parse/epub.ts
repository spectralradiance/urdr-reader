// EPUB → reader-ready chapters. Environment-agnostic: callers pass a DOMParser
// (the browser's, or linkedom's in Node) so the build script and in-app import share it.

import JSZip from 'jszip'
import type { TocEntry } from '../types.ts'
import { serializeNode, textWords } from './serialize.ts'

export type DomParserLike = { parseFromString(source: string, type: string): Document }

export type ParsedChapter = { title: string; html: string; words: number }

export type ParsedEpub = {
  title: string
  authors: string[]
  language: string
  subjects: string[]
  description?: string
  toc: TocEntry[]
  chapters: ParsedChapter[]
  anchors: Record<string, number>
  license?: string
  cover?: { name: string; data: Uint8Array }
  images: Map<string, Uint8Array>
  warnings: string[]
}

type RawTocEntry = { title: string; level: number; path: string; frag?: string }
type Block = { node: Node; doc: number }

const ELEMENT = 1
const MAX_CHAPTER_WORDS = 12_000
const TARGET_PART_WORDS = 6_000
const TEXT = 3

export async function parseEpub(data: ArrayBuffer | Uint8Array, parser: DomParserLike): Promise<ParsedEpub> {
  const zip = await JSZip.loadAsync(data)
  const warnings: string[] = []
  const readText = async (path: string) => {
    const file = zip.file(path)
    if (!file) throw new Error(`EPUB is missing ${path}`)
    return file.async('string')
  }
  const parseXml = (src: string) => parser.parseFromString(src, 'text/xml')

  // 1. Package document
  const container = parseXml(await readText('META-INF/container.xml'))
  const opfPath = findAll(container, 'rootfile')[0]?.getAttribute('full-path')
  if (!opfPath) throw new Error('EPUB container has no rootfile')
  const opf = parseXml(await readText(opfPath))

  const manifest = new Map<string, { path: string; type: string; props: string[] }>()
  for (const item of findAll(opf, 'item')) {
    manifest.set(item.getAttribute('id') ?? '', {
      path: resolvePath(opfPath, item.getAttribute('href') ?? ''),
      type: item.getAttribute('media-type') ?? '',
      props: (item.getAttribute('properties') ?? '').split(/\s+/),
    })
  }
  const spineEl = findAll(opf, 'spine')[0]
  const spine = findAll(opf, 'itemref')
    .map((ref) => manifest.get(ref.getAttribute('idref') ?? ''))
    .filter((item) => item && /html/.test(item.type))
    .map((item) => item!.path)

  const meta = findAll(opf, 'metadata')[0] ?? opf.documentElement
  const metaText = (name: string) => findAll(meta, name).map((el) => clean(el.textContent))
  const title = metaText('title')[0] ?? 'Untitled'
  const authors = metaText('creator')
  const language = metaText('language')[0] ?? 'en'
  const subjects = metaText('subject')
  const description = metaText('description')[0]

  // 2. Table of contents (EPUB 3 nav, else EPUB 2 NCX)
  let rawToc: RawTocEntry[] = []
  const navItem = [...manifest.values()].find((item) => item.props.includes('nav'))
  if (navItem) rawToc = readNav(parser.parseFromString(await readText(navItem.path), 'text/xml'), navItem.path)
  if (rawToc.length === 0) {
    const ncxItem = manifest.get(spineEl?.getAttribute('toc') ?? '')
      ?? [...manifest.values()].find((item) => item.type === 'application/x-dtbncx+xml')
    if (ncxItem) rawToc = readNcx(parseXml(await readText(ncxItem.path)), ncxItem.path)
  }

  // 3. Spine documents → flat list of top-level blocks, with Gutenberg boilerplate removed
  let license: string | undefined
  const docs: { path: string; ids: Map<string, Element>; blocks: Node[] }[] = []
  for (const path of spine) {
    const src = await readText(path)
    let doc = parser.parseFromString(src, 'text/xml')
    if (findAll(doc, 'parsererror').length > 0) doc = parser.parseFromString(src, 'text/html')
    const body = findAll(doc, 'body')[0]
    if (!body) continue
    for (const el of findAll(body, '*')) {
      const id = el.getAttribute('id') ?? ''
      const cls = el.getAttribute('class') ?? ''
      if (id === 'pg-header' || id === 'pg-footer' || /\bpg-boilerplate\b/.test(cls)) {
        if (id === 'pg-footer' || /\bpgfooter\b/.test(cls)) license = (license ?? '') + serializeNode(el)
        el.parentNode?.removeChild(el)
      }
    }
    const ids = new Map<string, Element>()
    for (const el of findAll(body, '*')) {
      const id = el.getAttribute('id')
      if (id) ids.set(id, el)
    }
    docs.push({ path, ids, blocks: topLevelBlocks(body) })
  }

  const blocks: Block[] = docs.flatMap((d, doc) => d.blocks.map((node) => ({ node, doc })))
  const blockIndexOf = new Map<Node, number>(blocks.map((b, i) => [b.node, i]))
  const docStart = (doc: number) => blocks.findIndex((b) => b.doc === doc)

  // Where in the block list does a TOC target begin?
  const locate = (path: string, frag?: string): number | undefined => {
    const doc = docs.findIndex((d) => d.path === path)
    if (doc < 0) return undefined
    if (!frag) return nonNegative(docStart(doc))
    let el: Node | null = docs[doc].ids.get(frag) ?? null
    if (!el) return undefined // target was boilerplate (e.g. the PG license)
    while (el && !blockIndexOf.has(el)) el = el.parentNode
    return el ? blockIndexOf.get(el) : nonNegative(docStart(doc))
  }

  const toc = rawToc
    .map((entry) => ({ ...entry, block: locate(entry.path, entry.frag) }))
    .filter((entry): entry is RawTocEntry & { block: number } => entry.block !== undefined)

  // 4. Split into chapters at the shallowest TOC level with enough entries
  const levels = toc.map((e) => e.level)
  let splitLevel = Math.min(...levels, 1)
  while (toc.filter((e) => e.level <= splitLevel).length < 3 && levels.some((l) => l > splitLevel) && splitLevel < 2)
    splitLevel++

  const splits: { block: number; title: string }[] = []
  for (const entry of toc.filter((e) => e.level <= splitLevel)) {
    if (!splits.some((s) => s.block === entry.block)) splits.push({ block: entry.block, title: entry.title })
  }
  splits.sort((a, b) => a.block - b.block)

  if (splits.length === 0) {
    warnings.push('No usable table of contents; splitting by spine document')
    docs.forEach((d, doc) => {
      const start = docStart(doc)
      if (start >= 0) splits.push({ block: start, title: headingText(d.blocks) ?? `Section ${splits.length + 1}` })
    })
  }

  const blockWords = blocks.map((b) => textWords(b.node))
  const wordsIn = (start: number, end: number) => blockWords.slice(start, end).reduce((n, w) => n + w, 0)

  type Range = { title: string; start: number; end: number }
  // Long chapters (a "Volume" or "Book" holding dozens of sections) split again at the next
  // TOC level down, so the reader never renders a 600k-word chapter.
  const refine = (range: Range, level: number): Range[] => {
    if (wordsIn(range.start, range.end) <= MAX_CHAPTER_WORDS) return [range]
    const inside = toc.filter((e) => e.level > level && e.block > range.start && e.block < range.end)
    if (inside.length === 0) return splitUntitled(range)
    const subLevel = Math.min(...inside.map((e) => e.level))
    const subs = inside.filter((e) => e.level === subLevel)
    const pieces: Range[] = [{ title: range.title, start: range.start, end: subs[0].block }]
    subs.forEach((s, i) => {
      if (s.block === pieces[pieces.length - 1].start) return
      pieces[pieces.length - 1].end = s.block
      pieces.push({ title: s.title, start: s.block, end: subs[i + 1]?.block ?? range.end })
    })
    pieces[pieces.length - 1].end = range.end
    // A lead-in that's only the parent's heading folds into the first section.
    if (pieces.length > 1 && wordsIn(pieces[0].start, pieces[0].end) < 60) {
      pieces[1] = { ...pieces[1], start: pieces[0].start }
      pieces.shift()
    }
    return pieces.flatMap((p) => refine(p, subLevel))
  }

  // No deeper TOC: split at headings in the text, else into roughly even parts at block boundaries.
  const splitUntitled = (range: Range): Range[] => {
    const headingAt = (i: number) => {
      const node = blocks[i].node
      if (node.nodeType !== ELEMENT) return undefined
      const el = node as Element
      const h = /^h[2-4]$/.test(el.localName) ? el : childElements(el).find((c) => /^h[2-4]$/.test(c.localName))
      const text = h ? clean(h.textContent) : ''
      return text && text.length < 120 ? text : undefined
    }
    const cuts: { block: number; title: string }[] = []
    let since = 0
    for (let i = range.start + 1; i < range.end; i++) {
      since += blockWords[i - 1]
      const heading = headingAt(i)
      if (heading && since >= 1500) {
        cuts.push({ block: i, title: heading })
        since = 0
      }
    }
    if (cuts.length === 0) {
      const parts = Math.ceil(wordsIn(range.start, range.end) / TARGET_PART_WORDS)
      const per = wordsIn(range.start, range.end) / parts
      since = 0
      for (let i = range.start + 1; i < range.end && cuts.length < parts - 1; i++) {
        since += blockWords[i - 1]
        if (since >= per) {
          cuts.push({ block: i, title: `${range.title} (${cuts.length + 2})` })
          since = 0
        }
      }
    }
    return [range.start, ...cuts.map((c) => c.block)].map((start, i) => ({
      title: i === 0 ? range.title : cuts[i - 1].title,
      start,
      end: cuts[i]?.block ?? range.end,
    }))
  }

  const ranges: Range[] = splits.flatMap((s, i) =>
    refine({ title: s.title, start: s.block, end: splits[i + 1]?.block ?? blocks.length }, splitLevel),
  )
  if (ranges.length > 0 && ranges[0].start > 0) {
    if (wordsIn(0, ranges[0].start) > 30) ranges.unshift({ title: 'Front matter', start: 0, end: ranges[0].start })
    else ranges[0].start = 0
  }

  const chapterOfBlock = (block: number) => ranges.findIndex((r) => block >= r.start && block < r.end)

  // 5. Internal links → anchors map; images → extracted files
  const anchors: Record<string, number> = {}
  const images = new Map<string, Uint8Array>()
  const imageNames = new Map<string, string>()

  const rewrite = (el: Element, doc: number) => {
    const docPath = docs[doc].path
    const href = el.getAttribute('href')
    if (href && el.localName === 'a' && !/^[a-z]+:/i.test(href)) {
      const [file, frag] = href.split('#')
      const targetPath = file ? resolvePath(docPath, file) : docPath
      const targetDoc = docs.findIndex((d) => d.path === targetPath)
      const block = locate(targetPath, frag)
      if (targetDoc >= 0 && block !== undefined) {
        const key = frag ?? `doc-${targetDoc}`
        anchors[key] = chapterOfBlock(block)
        el.setAttribute('href', `#${key}`)
      } else {
        el.removeAttribute('href')
      }
    }
    if (el.localName === 'img') {
      const src = el.getAttribute('src')
      if (!src) return
      const path = resolvePath(docPath, src)
      let name = imageNames.get(path)
      if (!name) {
        name = uniqueName(path.split('/').pop() ?? 'image', imageNames)
        imageNames.set(path, name)
      }
      el.setAttribute('src', `images/${name}`)
    }
  }

  for (const [doc, d] of docs.entries()) {
    for (const el of d.blocks.flatMap((b) => (b.nodeType === ELEMENT ? [b as Element, ...findAll(b as Element, '*')] : [])))
      rewrite(el, doc)
  }
  for (const [path, name] of imageNames) {
    const file = zip.file(path)
    if (file) images.set(name, await file.async('uint8array'))
    else warnings.push(`Missing image ${path}`)
  }

  // Ids of the first block in each doc, so `#doc-N` links land somewhere
  docs.forEach((_, doc) => {
    const start = docStart(doc)
    if (start >= 0 && blocks[start].node.nodeType === ELEMENT && anchors[`doc-${doc}`] !== undefined)
      (blocks[start].node as Element).setAttribute('id', (blocks[start].node as Element).getAttribute('id') ?? `doc-${doc}`)
  })

  const chapters: ParsedChapter[] = ranges.map((r) => {
    const nodes = blocks.slice(r.start, r.end).map((b) => b.node)
    return {
      title: r.title,
      html: nodes.map(serializeNode).join(''),
      words: wordsIn(r.start, r.end),
    }
  })

  // Every TOC entry (all levels) points at its chapter
  const tocOut: TocEntry[] = toc.map((e) => ({
    title: e.title,
    level: e.level,
    chapterIndex: chapterOfBlock(e.block),
    anchor: e.frag,
  }))
  for (const e of tocOut) if (e.anchor && anchors[e.anchor] === undefined) anchors[e.anchor] = e.chapterIndex
  if (ranges[0]?.title === 'Front matter') tocOut.unshift({ title: 'Front matter', level: 1, chapterIndex: 0 })

  // Cover
  let cover: ParsedEpub['cover']
  const coverId = findAll(meta, 'meta').find((m) => m.getAttribute('name') === 'cover')?.getAttribute('content')
  const coverItem = [...manifest.values()].find((item) => item.props.includes('cover-image')) ?? manifest.get(coverId ?? '')
  if (coverItem && coverItem.type.startsWith('image/')) {
    const file = zip.file(coverItem.path)
    if (file) cover = { name: `cover.${coverItem.path.split('.').pop()}`, data: await file.async('uint8array') }
  }

  if (chapters.length === 1) warnings.push('Only one chapter')
  if (chapters.length > 300) warnings.push(`${chapters.length} chapters`)
  if (chapters.some((c) => c.words === 0)) warnings.push('Some chapters are empty')

  return { title, authors, language, subjects, description, toc: tocOut, chapters, anchors, license, cover, images, warnings }
}

// ---------------------------------------------------------------------------

function readNav(doc: Document, navPath: string): RawTocEntry[] {
  const navs = findAll(doc, 'nav')
  const nav = navs.find((n) => (n.getAttribute('epub:type') ?? '').split(/\s+/).includes('toc')) ?? navs[0]
  const out: RawTocEntry[] = []
  const walk = (list: Element, level: number) => {
    for (const li of childElements(list).filter((el) => el.localName === 'li')) {
      const link = childElements(li).find((el) => el.localName === 'a' || el.localName === 'span')
      const href = link?.getAttribute('href')
      if (link && href) out.push({ title: clean(link.textContent), level, ...splitHref(navPath, href) })
      const sub = childElements(li).find((el) => el.localName === 'ol' || el.localName === 'ul')
      if (sub) walk(sub, level + 1)
    }
  }
  const list = nav && findAll(nav, 'ol')[0]
  if (list) walk(list, 1)
  return out
}

function readNcx(doc: Document, ncxPath: string): RawTocEntry[] {
  const out: RawTocEntry[] = []
  const walk = (parent: Element, level: number) => {
    for (const point of childElements(parent).filter((el) => el.localName === 'navPoint')) {
      const label = findAll(point, 'text')[0]
      const src = findAll(point, 'content')[0]?.getAttribute('src')
      if (label && src) out.push({ title: clean(label.textContent), level, ...splitHref(ncxPath, src) })
      walk(point, level + 1)
    }
  }
  const navMap = findAll(doc, 'navMap')[0]
  if (navMap) walk(navMap, 1)
  return out
}

/** Children of the innermost single-child wrapper under <body>. */
function topLevelBlocks(body: Element): Node[] {
  let container: Element = body
  for (;;) {
    const kids = significantChildren(container)
    if (kids.length === 1 && kids[0].nodeType === ELEMENT && !/^(p|h\d|table|ul|ol|pre|blockquote)$/.test((kids[0] as Element).localName))
      container = kids[0] as Element
    else return kids
  }
}

function significantChildren(el: Element): Node[] {
  return [...el.childNodes].filter((n) => n.nodeType === ELEMENT || (n.nodeType === TEXT && clean(n.textContent) !== ''))
}

function headingText(nodes: Node[]): string | undefined {
  for (const node of nodes) {
    if (node.nodeType !== ELEMENT) continue
    const el = node as Element
    const h = /^h[1-3]$/.test(el.localName) ? el : findAll(el, '*').find((e) => /^h[1-3]$/.test(e.localName))
    if (h) return clean(h.textContent)
  }
}

function findAll(root: Document | Element, localName: string): Element[] {
  const out: Element[] = []
  const walk = (node: Node) => {
    for (const child of node.childNodes) {
      if (child.nodeType !== ELEMENT) continue
      const el = child as Element
      if (localName === '*' || el.localName === localName || el.localName.split(':').pop() === localName) out.push(el)
      walk(el)
    }
  }
  walk(root)
  return out
}

function childElements(el: Element): Element[] {
  return [...el.childNodes].filter((n): n is Element => n.nodeType === ELEMENT)
}

function splitHref(base: string, href: string) {
  const [file, frag] = href.split('#')
  return { path: file ? resolvePath(base, file) : base, frag: frag || undefined }
}

export function resolvePath(base: string, href: string): string {
  const parts = base.split('/').slice(0, -1)
  for (const seg of decodeURIComponent(href.split('#')[0]).split('/')) {
    if (seg === '..') parts.pop()
    else if (seg !== '.' && seg !== '') parts.push(seg)
  }
  return parts.join('/')
}

function uniqueName(name: string, taken: Map<string, string>): string {
  const used = new Set(taken.values())
  let candidate = name.replace(/[^\w.-]/g, '_')
  for (let i = 2; used.has(candidate); i++) candidate = name.replace(/(\.\w+)?$/, `-${i}$1`)
  return candidate
}

function clean(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim()
}

function nonNegative(n: number): number | undefined {
  return n >= 0 ? n : undefined
}
