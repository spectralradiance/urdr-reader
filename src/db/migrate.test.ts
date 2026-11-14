import 'fake-indexeddb/auto'
import { Dexie } from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'

// Imported after fake-indexeddb so Dexie finds an IndexedDB to use.
const { db, LEGACY_DB_NAME } = await import('./db.ts')

async function seedLegacy(rows: { shelf?: object[]; quotes?: object[] }) {
  const legacy = new Dexie(LEGACY_DB_NAME)
  legacy.version(1).stores({
    positions: 'bookId, updatedAt',
    shelf: 'bookId, addedAt',
    follows: 'id, source, addedAt',
    settings: 'key',
  })
  legacy.version(2).stores({ quotes: 'id, bookId, [bookId+chapterIndex], createdAt' })
  await legacy.open()
  if (rows.shelf) await legacy.table('shelf').bulkAdd(rows.shelf)
  if (rows.quotes) await legacy.table('quotes').bulkAdd(rows.quotes)
  legacy.close()
}

const book = (bookId: string, title: string) => ({ bookId, title, authors: [], addedAt: 1 })

afterEach(async () => {
  db.close()
  await Dexie.delete(db.name)
  await Dexie.delete(LEGACY_DB_NAME)
})

describe('the Echtra to Urdr database migration', () => {
  it('copies the old database on first open, then deletes it', async () => {
    await seedLegacy({
      shelf: [book('pg1', 'Old shelf')],
      quotes: [
        {
          id: 'q1',
          bookId: 'pg1',
          chapterIndex: 0,
          text: 'A line',
          createdAt: 1,
          start: { block: 0, offset: 0 },
          end: { block: 0, offset: 6 },
        },
      ],
    })

    expect(await db.shelf.toArray()).toEqual([book('pg1', 'Old shelf')])
    expect((await db.quotes.get('q1'))?.text).toBe('A line')
    expect(await Dexie.exists(LEGACY_DB_NAME)).toBe(false)
  })

  it('keeps rows already in the new database over old ones with the same key', async () => {
    await db.open()
    await db.shelf.add(book('pg1', 'New shelf'))
    db.close()
    await seedLegacy({ shelf: [book('pg1', 'Old shelf'), book('pg2', 'Only old')] })

    await db.open()
    expect(await db.shelf.orderBy('bookId').toArray()).toEqual([
      book('pg1', 'New shelf'),
      book('pg2', 'Only old'),
    ])
  })

  it('does nothing when there is no old database', async () => {
    await db.open()
    expect(await db.shelf.count()).toBe(0)
  })
})
