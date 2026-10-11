// Builds the hosted library: Gutenberg EPUBs → public/library/{catalog.json, books/pg{n}/...}
//
//   npm run library                       # every collection
//   npm run library -- --only 2199,1727   # specific ebooks
//   npm run library -- --refresh          # re-download cached EPUBs
//
// Downloads are cached in .cache/epub and spaced 2s apart, per
// https://www.gutenberg.org/policy/robot_access.html. Set GUTENBERG_MIRROR to use a mirror.

import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DOMParser } from 'linkedom'
import { parseEpub, type DomParserLike } from '../../src/books/parse/epub.ts'
import type { BookManifest, Catalog, CatalogEntry } from '../../src/books/types.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const OUT = join(ROOT, 'public/library')
const CACHE = join(ROOT, '.cache/epub')
const COLLECTIONS = join(dirname(fileURLToPath(import.meta.url)), 'collections')
const MIRROR = (process.env.GUTENBERG_MIRROR ?? 'https://www.gutenberg.org').replace(/\/$/, '')
const USER_AGENT = 'EchtraLibraryBuilder/0.1 (non-commercial reader; one-time downloads, cached)'
const DOWNLOAD_DELAY_MS = 2000

type Collection = { id: string; title: string; description: string; books: { ebookNo: number; note?: string }[] }

const args = process.argv.slice(2)
const only = args.includes('--only') ? new Set(args[args.indexOf('--only') + 1].split(',').map(Number)) : undefined
const refresh = args.includes('--refresh')

const collections: Collection[] = []
for (const file of (await readdir(COLLECTIONS)).filter((f) => f.endsWith('.json')))
  collections.push(JSON.parse(await readFile(join(COLLECTIONS, file), 'utf8')))

const wanted = new Map<number, string[]>()
for (const c of collections)
  for (const b of c.books) if (!only || only.has(b.ebookNo)) wanted.set(b.ebookNo, [...(wanted.get(b.ebookNo) ?? []), c.id])

await mkdir(CACHE, { recursive: true })
await mkdir(join(OUT, 'books'), { recursive: true })

const report: string[] = []
let lastDownload = 0

for (const [ebookNo, inCollections] of wanted) {
  const id = `pg${ebookNo}`
  try {
    const epub = await getEpub(ebookNo)
    const parsed = await parseEpub(epub, new DOMParser() as unknown as DomParserLike)

    const dir = join(OUT, 'books', id)
    await rm(dir, { recursive: true, force: true })
    await mkdir(join(dir, 'images'), { recursive: true })

    for (const [i, ch] of parsed.chapters.entries()) await writeFile(join(dir, `ch-${i}.html`), ch.html)
    for (const [name, data] of parsed.images) await writeFile(join(dir, 'images', name), data)
    if (parsed.cover) await writeFile(join(dir, parsed.cover.name), parsed.cover.data)
    if (parsed.license) await writeFile(join(dir, 'license.html'), parsed.license)

    const manifest: BookManifest = {
      id,
      title: parsed.title,
      authors: parsed.authors,
      language: parsed.language,
      subjects: parsed.subjects,
      collections: inCollections,
      description: parsed.description,
      cover: parsed.cover?.name,
      source: {
        name: 'Project Gutenberg',
        ebookNo,
        url: `https://www.gutenberg.org/ebooks/${ebookNo}`,
        processed: new Date().toISOString().slice(0, 10),
      },
      toc: parsed.toc,
      chapters: parsed.chapters.map((ch, index) => ({ index, title: ch.title, file: `ch-${index}.html`, words: ch.words })),
      anchors: parsed.anchors,
      totalWords: parsed.chapters.reduce((n, ch) => n + ch.words, 0),
      hasLicense: Boolean(parsed.license),
    }
    await writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest))

    const flag = parsed.warnings.length ? ` ⚠ ${parsed.warnings.join('; ')}` : ''
    console.log(`✓ ${id} ${parsed.title} — ${parsed.chapters.length} chapters, ${parsed.toc.length} TOC entries${flag}`)
    report.push(`| ${id} | ${parsed.title} | ${parsed.chapters.length} | ${parsed.toc.length} | ${parsed.warnings.join('; ')} |`)
  } catch (err) {
    console.error(`✗ ${id}: ${(err as Error).message}`)
    report.push(`| ${id} | (failed) | | | ${(err as Error).message} |`)
  }
}

// Catalog is rebuilt from every manifest on disk, so partial (--only) runs keep the rest.
const books: CatalogEntry[] = []
for (const dir of await readdir(join(OUT, 'books'))) {
  const path = join(OUT, 'books', dir, 'manifest.json')
  if (!existsSync(path)) continue
  const m: BookManifest = JSON.parse(await readFile(path, 'utf8'))
  books.push({
    id: m.id, ebookNo: m.source.ebookNo, title: m.title, authors: m.authors, language: m.language,
    subjects: m.subjects, collections: m.collections, cover: m.cover, totalWords: m.totalWords,
  })
}
const catalog: Catalog = {
  generated: new Date().toISOString(),
  collections: collections.map(({ id, title, description }) => ({ id, title, description })),
  books,
}
await writeFile(join(OUT, 'catalog.json'), JSON.stringify(catalog))
await writeFile(
  join(ROOT, '.cache/library-report.md'),
  `# Library build report\n\n| id | title | chapters | toc | warnings |\n| --- | --- | --- | --- | --- |\n${report.join('\n')}\n`,
)
console.log(`\n${books.length} books in catalog. Report: .cache/library-report.md`)

async function getEpub(ebookNo: number): Promise<Uint8Array> {
  const cached = join(CACHE, `${ebookNo}.epub`)
  if (!refresh && existsSync(cached)) return readFile(cached)

  for (const name of [`pg${ebookNo}-images-3.epub`, `pg${ebookNo}-images.epub`]) {
    const wait = lastDownload + DOWNLOAD_DELAY_MS - Date.now()
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    lastDownload = Date.now()
    const res = await fetch(`${MIRROR}/cache/epub/${ebookNo}/${name}`, { headers: { 'User-Agent': USER_AGENT } })
    if (!res.ok) continue
    const data = new Uint8Array(await res.arrayBuffer())
    await writeFile(cached, data)
    return data
  }
  throw new Error('no EPUB available')
}
