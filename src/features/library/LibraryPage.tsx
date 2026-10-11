import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router'
import { db } from '../../db/db.ts'
import { authorName, shortTitle } from '../../lib/format.ts'
import { Cover } from '../../ui/Cover.tsx'

export function LibraryPage() {
  const shelf = useLiveQuery(() => db.shelf.toArray(), [])
  const positions = useLiveQuery(() => db.positions.toArray(), [])
  const progress = new Map(positions?.map((p) => [p.bookId, p]) ?? [])

  // Most recently read first, then most recently added.
  const books = [...(shelf ?? [])].sort(
    (a, b) => (progress.get(b.bookId)?.updatedAt ?? b.addedAt) - (progress.get(a.bookId)?.updatedAt ?? a.addedAt),
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-serif text-3xl">Your library</h1>

      {shelf?.length === 0 && (
        <p className="mt-6 text-muted">
          Nothing here yet. <Link to="/" className="text-accent underline">Find something to read</Link>.
        </p>
      )}

      <ul className="mt-8 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {books.map((b) => {
          const p = progress.get(b.bookId)
          return (
            <li key={b.bookId}>
              <Link to={p ? `/read/${b.bookId}` : `/book/${b.bookId}`} className="block">
                <Cover book={{ id: b.bookId, title: b.title, authors: b.authors, cover: b.cover }} />
                <h2 className="mt-3 line-clamp-2 text-sm font-medium">{shortTitle(b.title)}</h2>
                <p className="line-clamp-1 text-xs text-muted">{b.authors.map(authorName).join(', ') || 'Anonymous'}</p>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-2" title={`${Math.round((p?.percent ?? 0) * 100)}% read`}>
                  <div className="h-full bg-accent" style={{ width: `${Math.round((p?.percent ?? 0) * 100)}%` }} />
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
