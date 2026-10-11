import { useLiveQuery } from 'dexie-react-hooks'
import { BookOpen, Check, Copy, Download, NotebookPen, Send, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { db, type Quote } from '../../db/db.ts'
import { authorName, displayHeading, shortTitle } from '../../lib/format.ts'
import { blueskyIntentUrl, quotesToMarkdown, quoteWithCitation } from './quotes.ts'

export function QuotesPage() {
  const [params, setParams] = useSearchParams()
  const bookFilter = params.get('book')
  const quotes = useLiveQuery(() => db.quotes.orderBy('createdAt').reverse().toArray(), [])

  const books = new Map<string, { title: string; authors: string[]; count: number }>()
  for (const q of quotes ?? []) {
    const b = books.get(q.bookId)
    books.set(q.bookId, { title: q.bookTitle, authors: q.authors, count: (b?.count ?? 0) + 1 })
  }
  const shown = (quotes ?? []).filter((q) => !bookFilter || q.bookId === bookFilter)

  const exportMarkdown = () => {
    const blob = new Blob([quotesToMarkdown(shown)], { type: 'text/markdown' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `echtra-quotes-${new Date().toISOString().slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl">Quotes</h1>
          <p className="mt-1 text-sm text-muted">Select text while reading and choose “Save quote”.</p>
        </div>
        {shown.length > 0 && (
          <button
            type="button"
            onClick={exportMarkdown}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:bg-surface-2"
          >
            <Download className="size-4" aria-hidden /> Export Markdown
          </button>
        )}
      </div>

      {books.size > 1 && (
        <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Filter by book">
          <FilterChip active={!bookFilter} onClick={() => setParams({})}>All · {quotes?.length}</FilterChip>
          {[...books].map(([id, b]) => (
            <FilterChip key={id} active={bookFilter === id} onClick={() => setParams({ book: id })}>
              {shortTitle(b.title)} · {b.count}
            </FilterChip>
          ))}
        </div>
      )}

      {quotes?.length === 0 && (
        <div className="mt-10 rounded-lg border border-dashed border-border p-8 text-center text-muted">
          <p className="font-medium text-fg">No quotes yet</p>
          <p className="mt-2 text-sm">
            Open a book from <Link to="/" className="text-accent underline">Discover</Link>, highlight a passage, and save it.
          </p>
        </div>
      )}

      <ul className="mt-8 space-y-5">
        {shown.map((q) => (
          <li key={q.id}>
            <QuoteCard quote={q} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1 text-xs ${active ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-muted hover:text-fg'}`}
    >
      {children}
    </button>
  )
}

function QuoteCard({ quote: q }: { quote: Quote }) {
  const [editing, setEditing] = useState(false)
  const [note, setNote] = useState(q.note ?? '')
  const [copied, setCopied] = useState(false)

  const restore = { bookId: q.bookId, chapterIndex: q.chapterIndex, ...q.start, percent: 0, updatedAt: 0 }

  return (
    <figure className="rounded-lg border border-border bg-surface p-5">
      <blockquote className="font-serif text-lg leading-relaxed whitespace-pre-line">“{q.text}”</blockquote>
      <figcaption className="mt-3 text-sm text-muted">
        — {q.authors.map(authorName).join(', ') || 'Anonymous'},{' '}
        <Link to={`/book/${q.bookId}`} className="italic hover:underline">{shortTitle(q.bookTitle)}</Link>
        {' · '}
        {displayHeading(q.chapterTitle)}
      </figcaption>

      {editing ? (
        <form
          className="mt-4"
          onSubmit={async (e) => {
            e.preventDefault()
            await db.quotes.update(q.id, { note: note.trim() || undefined })
            setEditing(false)
          }}
        >
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            autoFocus
            aria-label="Note"
            placeholder="Your thoughts on this passage…"
            className="w-full rounded-md border border-border bg-bg p-2 text-sm focus:border-accent focus:outline-none"
          />
          <div className="mt-2 flex gap-2 text-sm">
            <button type="submit" className="rounded-full bg-accent px-4 py-1.5 text-accent-fg">Save note</button>
            <button type="button" onClick={() => { setNote(q.note ?? ''); setEditing(false) }} className="px-3 py-1.5 text-muted">Cancel</button>
          </div>
        </form>
      ) : (
        q.note && <p className="mt-4 border-l-2 border-accent pl-3 text-sm whitespace-pre-line">{q.note}</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-1 text-xs text-muted">
        <Link to={`/read/${q.bookId}/${q.chapterIndex}`} state={{ restore }} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 hover:bg-surface-2 hover:text-fg">
          <BookOpen className="size-3.5" aria-hidden /> Go to passage
        </Link>
        <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 hover:bg-surface-2 hover:text-fg">
          <NotebookPen className="size-3.5" aria-hidden /> {q.note ? 'Edit note' : 'Add note'}
        </button>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(quoteWithCitation(q))
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 hover:bg-surface-2 hover:text-fg"
        >
          {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />} {copied ? 'Copied' : 'Copy'}
        </button>
        <a href={blueskyIntentUrl(q)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 hover:bg-surface-2 hover:text-fg">
          <Send className="size-3.5" aria-hidden /> Share on Bluesky
        </a>
        <span className="ml-auto">{new Date(q.createdAt).toLocaleDateString()}</span>
        <button
          type="button"
          onClick={() => confirm('Delete this quote?') && db.quotes.delete(q.id)}
          className="grid size-7 place-items-center rounded-full hover:bg-surface-2 hover:text-fg"
          aria-label="Delete quote"
        >
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      </div>
    </figure>
  )
}
