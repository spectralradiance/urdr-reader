import { ExternalLink, Plus, RefreshCw, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { db } from '../../db/db.ts'
import { useFollows, useMergedTimeline } from '../../social/hooks.ts'
import { resolveFollow, SOURCES, type SourceId } from '../../social/sources.ts'
import { Spinner } from '../../ui/AppShell.tsx'
import { PostCard } from './PostCard.tsx'

export function ReadingRoomPage() {
  const follows = useFollows()
  const timeline = useMergedTimeline(follows)
  const [filter, setFilter] = useState<SourceId | 'all'>('all')

  const sourcesInUse = new Set(follows?.map((f) => f.source))
  const items = timeline.items.filter((i) => filter === 'all' || i.source === filter)

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1fr_320px]">
      <section className="min-w-0">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl">Reading Room</h1>
            <p className="mt-1 text-sm text-muted">Newest first, from the Bluesky and Substack sources you follow. No algorithm.</p>
          </div>
          {follows && follows.length > 0 && (
            <button
              type="button"
              onClick={timeline.refetch}
              className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
              aria-label="Refresh"
            >
              <RefreshCw className={`size-4 ${timeline.loading ? 'animate-spin' : ''}`} aria-hidden />
            </button>
          )}
        </div>

        {sourcesInUse.size > 1 && (
          <div className="mb-4 flex gap-2" role="group" aria-label="Filter by source">
            {(['all', ...sourcesInUse] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilter(s)}
                aria-pressed={filter === s}
                className={`rounded-full px-3 py-1 text-xs ${filter === s ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-muted hover:text-fg'}`}
              >
                {s === 'all' ? 'All' : SOURCES[s].label}
              </button>
            ))}
          </div>
        )}

        {timeline.errors.map((e) => (
          <p key={e.follow.id} className="mb-3 rounded border border-border p-3 text-sm text-muted">
            Couldn't load {e.follow.label}: {e.message}
          </p>
        ))}

        {follows === undefined || (timeline.loading && timeline.items.length === 0) ? (
          <Spinner />
        ) : follows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted">
            <p className="font-medium text-fg">Your Reading Room is empty</p>
            <p className="mt-2 text-sm">Follow a Bluesky account, feed or list, or a Substack publication, to start.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <PostCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <FollowManager />
      </aside>
    </div>
  )
}

function FollowManager() {
  const follows = useFollows()
  const [source, setSource] = useState<SourceId>('bluesky')
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const add = async (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    setBusy(true)
    setError(null)
    try {
      await db.follows.put(await resolveFollow(source, input))
      setInput('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h2 className="font-medium">Following</h2>

      <div className="mt-3 flex rounded-full bg-surface-2 p-1 text-sm" role="group" aria-label="Source">
        {(Object.keys(SOURCES) as SourceId[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setSource(s)
              setError(null)
            }}
            aria-pressed={source === s}
            className={`flex-1 rounded-full py-1 ${source === s ? 'bg-bg font-medium shadow-sm' : 'text-muted'}`}
          >
            {SOURCES[s].label}
          </button>
        ))}
      </div>

      <form onSubmit={add} className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={SOURCES[source].placeholder}
          aria-label={`${SOURCES[source].label} address`}
          className="min-w-0 flex-1 rounded-md border border-border bg-bg px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy}
          className="grid size-9 shrink-0 place-items-center rounded-md bg-accent text-accent-fg disabled:opacity-50"
          aria-label="Follow"
        >
          <Plus className="size-4" aria-hidden />
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
      <p className="mt-2 text-xs text-muted">{SOURCES[source].hint}</p>

      <ul className="mt-4 space-y-1">
        {follows?.map((f) => (
          <li key={f.id} className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-surface-2">
            <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] tracking-wide text-muted uppercase">
              {f.source === 'substack' ? 'substack' : f.kind}
            </span>
            <a href={f.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:underline">
              {f.label}
              <ExternalLink className="ml-1 inline size-3 text-muted" aria-hidden />
            </a>
            <button
              type="button"
              onClick={() => db.follows.delete(f.id)}
              className="grid size-6 place-items-center rounded text-muted hover:text-fg"
              aria-label={`Unfollow ${f.label}`}
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
