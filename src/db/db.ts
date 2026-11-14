import { Dexie, type EntityTable } from 'dexie'

export type ReadingPosition = {
  bookId: string
  chapterIndex: number
  /** Index of the top-level block in the chapter, plus a character offset into it. */
  block: number
  offset: number
  /** 0..1 through the whole book, for progress bars. */
  percent: number
  updatedAt: number
}

export type ShelfBook = {
  bookId: string
  title: string
  authors: string[]
  cover?: string
  addedAt: number
  finishedAt?: number
}

export type Follow = {
  id: string
  source: 'bluesky' | 'substack'
  kind: 'author' | 'feed' | 'list' | 'publication'
  /** Bluesky: DID for authors, at:// URI for feeds and lists. Substack: the publication's feed URL. */
  target: string
  avatar?: string
  label: string
  url: string
  addedAt: number
}

export type SettingsRow = { key: string; value: unknown }

/** A passage saved from the reader. Offsets are character offsets into top-level blocks. */
export type Quote = {
  id: string
  bookId: string
  bookTitle: string
  authors: string[]
  ebookNo: number
  chapterIndex: number
  chapterTitle: string
  text: string
  note?: string
  start: { block: number; offset: number }
  end: { block: number; offset: number }
  createdAt: number
}

export const db = new Dexie('urdr') as Dexie & {
  positions: EntityTable<ReadingPosition, 'bookId'>
  shelf: EntityTable<ShelfBook, 'bookId'>
  follows: EntityTable<Follow, 'id'>
  settings: EntityTable<SettingsRow, 'key'>
  quotes: EntityTable<Quote, 'id'>
}

db.version(1).stores({
  positions: 'bookId, updatedAt',
  shelf: 'bookId, addedAt',
  follows: 'id, source, addedAt',
  settings: 'key',
})

db.version(2).stores({
  quotes: 'id, bookId, [bookId+chapterIndex], createdAt',
})

/** The database's name before the app was renamed from Echtra to Urdr. */
export const LEGACY_DB_NAME = 'echtra'

/**
 * Copies a database left under the old name into this one, then deletes the old one, so
 * nothing is copied twice. Rows already here win over old ones with the same key.
 */
export async function migrateLegacyDatabase(target: Dexie, legacyName = LEGACY_DB_NAME) {
  if (!(await Dexie.exists(legacyName))) return
  const legacy = new Dexie(legacyName)
  await legacy.open()
  const tables = await Promise.all(
    legacy.tables
      .filter((t) => target.tables.some((own) => own.name === t.name))
      .map(async (t) => ({ name: t.name, rows: await t.toArray() })),
  )
  legacy.close()
  await target.transaction('rw', target.tables, async () => {
    for (const { name, rows } of tables) {
      const table = target.table(name)
      // Every table here is keyed by one field of the row (bookId, id or key).
      const keyPath = table.schema.primKey.keyPath as string
      const existing = new Set((await table.toCollection().primaryKeys()).map(String))
      const missing = rows.filter((row) => !existing.has(String(row[keyPath])))
      if (missing.length) await table.bulkAdd(missing)
    }
  })
  await Dexie.delete(legacyName)
}

// Runs before any query, so the app never reads the new database half-filled. Sticky, so it
// also runs if the database is closed and opened again.
db.on(
  'ready',
  (vipDb) =>
    migrateLegacyDatabase(vipDb).catch((err) =>
      console.error('Copying the old Echtra database failed', err),
    ),
  true,
)
