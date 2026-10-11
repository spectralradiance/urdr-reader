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

export const db = new Dexie('echtra') as Dexie & {
  positions: EntityTable<ReadingPosition, 'bookId'>
  shelf: EntityTable<ShelfBook, 'bookId'>
  follows: EntityTable<Follow, 'id'>
  settings: EntityTable<SettingsRow, 'key'>
}

db.version(1).stores({
  positions: 'bookId, updatedAt',
  shelf: 'bookId, addedAt',
  follows: 'id, source, addedAt',
  settings: 'key',
})
