import DOMPurify from 'dompurify'
import { useLiveQuery } from 'dexie-react-hooks'
import { BookmarkPlus, Check, ExternalLink, Play, Quote } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useLicense, useManifest } from '../../books/hosted.ts'
import type { BookManifest } from '../../books/types.ts'
import { db } from '../../db/db.ts'
import { authorName, readingTime, shortTitle, subtitle } from '../../lib/format.ts'
import { Cover } from '../../ui/Cover.tsx'
import { ErrorNote, Spinner } from '../../ui/AppShell.tsx'
import { TocList } from '../reader/TocList.tsx'
import { ConversationPanel } from '../social/ConversationPanel.tsx'

export function BookPage() {
  const { id } = useParams()
  const manifest = useManifest(id)
  const position = useLiveQuery(() => (id ? db.positions.get(id) : undefined), [id])
  const onShelf = useLiveQuery(() => (id ? db.shelf.get(id) : undefined), [id])
  const quoteCount = useLiveQuery(
    () => (id ? db.quotes.where('bookId').equals(id).count() : 0),
    [id],
  )

  if (manifest.isLoading) return <Spinner />
  if (manifest.error || !manifest.data)
    return <ErrorNote error={manifest.error ?? 'Book not found'} />
  const book = manifest.data
  const sub = subtitle(book.title)

  const toggleShelf = () =>
    onShelf
      ? db.shelf.delete(book.id)
      : db.shelf.put({
          bookId: book.id,
          title: book.title,
          authors: book.authors,
          cover: book.cover,
          addedAt: Date.now(),
        })

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="grid gap-10 md:grid-cols-[220px_1fr]">
        <div className="mx-auto w-44 md:w-full">
          <Cover book={book} />
        </div>

        <div>
          <h1 className="font-serif text-3xl leading-tight font-semibold sm:text-4xl">
            {shortTitle(book.title)}
          </h1>
          {sub && <p className="mt-2 font-serif text-lg text-muted italic">{sub}</p>}
          <p className="mt-3 text-fg">{book.authors.map(authorName).join(', ') || 'Anonymous'}</p>
          <p className="mt-1 text-sm text-muted">
            {book.chapters.length} chapters · about {readingTime(book.totalWords)} ·{' '}
            {book.totalWords.toLocaleString()} words
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to={`/read/${book.id}`}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 font-medium text-accent-fg hover:opacity-90"
            >
              <Play className="size-4" aria-hidden />
              {position ? `Continue · ${Math.round(position.percent * 100)}%` : 'Start reading'}
            </Link>
            <button
              type="button"
              onClick={toggleShelf}
              className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm hover:bg-surface-2"
            >
              {onShelf ? (
                <Check className="size-4" aria-hidden />
              ) : (
                <BookmarkPlus className="size-4" aria-hidden />
              )}
              {onShelf ? 'In your library' : 'Add to library'}
            </button>
            {quoteCount ? (
              <Link
                to={`/quotes?book=${book.id}`}
                className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm hover:bg-surface-2"
              >
                <Quote className="size-4" aria-hidden />
                {quoteCount} saved {quoteCount === 1 ? 'quote' : 'quotes'}
              </Link>
            ) : null}
          </div>

          {book.subjects.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-2">
              {book.subjects.slice(0, 8).map((s) => (
                <li key={s} className="rounded-full bg-surface-2 px-3 py-1 text-xs text-muted">
                  {s.replace(/ -- .*/, '')}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_340px]">
            <section>
              <h2 className="mb-3 font-serif text-xl">Contents</h2>
              <div className="rounded-lg border border-border bg-surface p-2">
                <TocList
                  book={book}
                  currentChapter={position?.chapterIndex}
                  linkTo={(e) =>
                    `/read/${book.id}/${e.chapterIndex}${e.anchor ? `#${e.anchor}` : ''}`
                  }
                />
              </div>
            </section>

            <aside className="space-y-8">
              <ConversationPanel book={book} />
              <Citation book={book} />
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}

function Citation({ book }: { book: BookManifest }) {
  const [showLicense, setShowLicense] = useState(false)
  const license = useLicense(book.id, showLicense && book.hasLicense)
  return (
    <section className="rounded-lg border border-border p-4 text-sm">
      <h2 className="font-medium">Source</h2>
      <p className="mt-2 text-muted">
        {book.source.name} eBook #{book.source.ebookNo}. Public domain in the USA. Prepared for
        Echtra on {book.source.processed}.
      </p>
      <a
        href={book.source.url}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center gap-1 text-accent underline"
      >
        View on Project Gutenberg <ExternalLink className="size-3" aria-hidden />
      </a>
      {book.hasLicense && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowLicense((v) => !v)}
            className="text-muted underline"
          >
            {showLicense ? 'Hide' : 'Show'} the Project Gutenberg license
          </button>
          {showLicense && license.data && (
            <div
              className="prose prose-sm mt-3 max-h-80 overflow-y-auto text-muted dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(license.data) }}
            />
          )}
        </div>
      )}
    </section>
  )
}
