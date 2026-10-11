import Dexie, { type EntityTable } from 'dexie'

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
  source: 'bluesky'
  kind: 'author' | 'feed' | 'list'
  /** Handle/DID for authors, at:// URI for feeds and lists. */
  target: string
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

export const db = new Dexie('echtra') as Dexie & {
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
