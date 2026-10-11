import { Link } from 'react-router'
import type { BookManifest } from '../../books/types.ts'
import { useFollows, useMergedTimeline } from '../../social/hooks.ts'
import { bookMatcher } from '../../social/match.ts'
import { PostCard } from './PostCard.tsx'

/** Posts and articles from the reader's followed sources that might be about this book. */
export function ConversationPanel({ book }: { book: BookManifest }) {
  const follows = useFollows()
  const timeline = useMergedTimeline(follows)
  const matches = timeline.items.filter(bookMatcher(book)).slice(0, 5)

  return (
    <section>
      <h2 className="font-serif text-xl">Conversation</h2>
      <p className="mt-1 mb-3 text-xs text-muted">Possibly related posts from feeds you follow.</p>

      {follows && follows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted">
          Follow some Bluesky accounts or Substack publications in the{' '}
          <Link to="/room" className="text-accent underline">Reading Room</Link> to see what people are saying.
        </p>
      ) : timeline.loading ? (
        <p className="text-sm text-muted">Checking your feeds…</p>
      ) : matches.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted">
          Nothing about this book in your feeds right now.
        </p>
      ) : (
        <div className="space-y-3">
          {matches.map((item) => (
            <PostCard key={item.id} item={item} compact />
          ))}
        </div>
      )}
    </section>
  )
}
