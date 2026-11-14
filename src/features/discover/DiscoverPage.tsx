import { useLiveQuery } from 'dexie-react-hooks'
import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useCatalog } from '../../books/hosted.ts'
import type { CatalogEntry } from '../../books/types.ts'
import { db } from '../../db/db.ts'
import { authorName, readingTime, shortTitle } from '../../lib/format.ts'
import { Cover } from '../../ui/Cover.tsx'
import { ErrorNote, Spinner } from '../../ui/AppShell.tsx'

export function DiscoverPage() {
  const catalog = useCatalog()
  const [query, setQuery] = useState('')
  const recent = useLiveQuery(
    // oxlint-disable-next-line unicorn/no-array-reverse -- Dexie's Collection.reverse() sets the query order; it isn't Array#reverse
    () => db.positions.orderBy('updatedAt').reverse().limit(6).toArray(),
    [],
  )

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!catalog.data || !q) return null
    return catalog.data.books.filter((b) =>
      [b.title, ...b.authors, ...b.subjects].some((field) => field.toLowerCase().includes(q)),
    )
  }, [catalog.data, query])

  if (catalog.isLoading) return <Spinner label="Opening the library…" />
  if (catalog.error) return <ErrorNote error={catalog.error} />
  const data = catalog.data!
  const byId = new Map(data.books.map((b) => [b.id, b]))
  const continuing = (recent ?? []).flatMap((p) => {
    const book = byId.get(p.bookId)
    return book ? [{ book, percent: p.percent }] : []
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="relative max-w-xl">
        <Search
          className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search titles, authors, subjects…"
          aria-label="Search the library"
          className="w-full rounded-full border border-border bg-surface py-2.5 pr-4 pl-10 text-fg placeholder:text-muted focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
        />
      </div>

      {results ? (
        <section className="mt-8">
          <h2 className="mb-4 text-sm font-medium text-muted">
            {results.length} {results.length === 1 ? 'book' : 'books'} matching “{query.trim()}”
          </h2>
          <BookGrid books={results} />
        </section>
      ) : (
        <>
          {continuing.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-4 font-serif text-2xl">Continue reading</h2>
              <div className="flex gap-4 overflow-x-auto pb-2">
                {continuing.map(({ book, percent }) => (
                  <Link key={book.id} to={`/read/${book.id}`} className="w-28 shrink-0">
                    <Cover book={book} />
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full bg-accent"
                        style={{ width: `${Math.round(percent * 100)}%` }}
                      />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {data.collections.map((c) => {
            const books = data.books.filter((b) => b.collections.includes(c.id))
            if (books.length === 0) return null
            return (
              <section key={c.id} className="mt-10">
                <h2 className="font-serif text-2xl">{c.title}</h2>
                <p className="mt-1 mb-5 max-w-2xl text-sm text-muted">{c.description}</p>
                <BookGrid books={books} />
              </section>
            )
          })}
        </>
      )}
    </div>
  )
}

function BookGrid({ books }: { books: CatalogEntry[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {books.map((book) => (
        <li key={book.id}>
          <Link to={`/book/${book.id}`} className="group block">
            <Cover
              book={book}
              className="transition-transform duration-300 group-hover:-translate-y-1"
            />
            <h3 className="mt-3 line-clamp-2 text-sm leading-snug font-medium text-fg">
              {shortTitle(book.title)}
            </h3>
            <p className="mt-0.5 line-clamp-1 text-xs text-muted">
              {book.authors.map(authorName).join(', ') || 'Anonymous'} ·{' '}
              {readingTime(book.totalWords)}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  )
}
