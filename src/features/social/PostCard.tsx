import { Heart, MessageCircle, Repeat2 } from 'lucide-react'
import type { SocialItem } from '../../social/types.ts'
import { timeAgo } from '../../lib/format.ts'

export function PostCard({ item, compact = false }: { item: SocialItem; compact?: boolean }) {
  if (item.source === 'substack') return <ArticleCard item={item} compact={compact} />
  return (
    <article className="relative rounded-lg border border-border bg-surface p-4 text-sm">
      {item.repostedBy && (
        <p className="mb-2 flex items-center gap-1 text-xs text-muted">
          <Repeat2 className="size-3" aria-hidden /> Reposted by {item.repostedBy}
        </p>
      )}
      <header className="flex items-center gap-2">
        {item.author.avatar ? (
          <img src={item.author.avatar} alt="" className="size-8 rounded-full" loading="lazy" />
        ) : (
          <div className="size-8 rounded-full bg-surface-2" />
        )}
        <div className="min-w-0 flex-1">
          <a
            href={item.author.url}
            target="_blank"
            rel="noreferrer"
            className="block truncate font-medium hover:underline"
          >
            {item.author.name}
          </a>
          <p className="truncate text-xs text-muted">@{item.author.handle}</p>
        </div>
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-muted hover:underline"
        >
          {timeAgo(item.createdAt)}
        </a>
      </header>

      <p className={`mt-3 whitespace-pre-wrap break-words ${compact ? 'line-clamp-6' : ''}`}>
        {item.text}
      </p>

      {!compact && item.images && item.images.length > 0 && (
        <div className={`mt-3 grid gap-1 ${item.images.length > 1 ? 'grid-cols-2' : ''}`}>
          {item.images.slice(0, 4).map((img) => (
            <img
              key={img.thumb}
              src={img.thumb}
              alt={img.alt}
              loading="lazy"
              className="max-h-72 w-full rounded object-cover"
            />
          ))}
        </div>
      )}

      {item.embed && (
        <a
          href={item.embed.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex gap-3 overflow-hidden rounded border border-border hover:bg-surface-2"
        >
          {item.embed.thumb && !compact && (
            <img
              src={item.embed.thumb}
              alt=""
              className="w-24 shrink-0 object-cover"
              loading="lazy"
            />
          )}
          <div className="min-w-0 p-2">
            <p className="line-clamp-2 font-medium">{item.embed.title}</p>
            <p className="truncate text-xs text-muted">{new URL(item.embed.url).hostname}</p>
          </div>
        </a>
      )}

      <footer className="mt-3 flex items-center gap-4 text-xs text-muted">
        {item.stats && (
          <>
            <span className="flex items-center gap-1">
              <MessageCircle className="size-3.5" aria-hidden />
              {item.stats.replies}
            </span>
            <span className="flex items-center gap-1">
              <Repeat2 className="size-3.5" aria-hidden />
              {item.stats.reposts}
            </span>
            <span className="flex items-center gap-1">
              <Heart className="size-3.5" aria-hidden />
              {item.stats.likes}
            </span>
          </>
        )}
        <a href={item.url} target="_blank" rel="noreferrer" className="ml-auto hover:underline">
          Open on Bluesky
        </a>
      </footer>
    </article>
  )
}

/** A Substack post: title, subtitle and cover image, linking out to the full article. */
function ArticleCard({ item, compact }: { item: SocialItem; compact: boolean }) {
  const cover = item.images?.[0]?.thumb
  return (
    <article className="rounded-lg border border-border bg-surface p-4 text-sm">
      <header className="flex items-center gap-2">
        {item.author.avatar ? (
          <img src={item.author.avatar} alt="" className="size-8 rounded" loading="lazy" />
        ) : (
          <div className="size-8 rounded bg-surface-2" />
        )}
        <a
          href={item.author.url}
          target="_blank"
          rel="noreferrer"
          className="min-w-0 flex-1 truncate font-medium hover:underline"
        >
          {item.author.name}
        </a>
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-muted hover:underline"
        >
          {timeAgo(item.createdAt)}
        </a>
      </header>

      <a href={item.url} target="_blank" rel="noreferrer" className="mt-3 flex gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-lg leading-snug font-semibold hover:underline">
            {item.title}
          </h3>
          {item.text && (
            <p className={`mt-1 text-muted ${compact ? 'line-clamp-2' : 'line-clamp-3'}`}>
              {item.text}
            </p>
          )}
        </div>
        {cover && !compact && (
          <img
            src={cover}
            alt=""
            loading="lazy"
            className="h-20 w-28 shrink-0 rounded object-cover"
          />
        )}
      </a>

      <footer className="mt-3 flex justify-end text-xs text-muted">
        <a href={item.url} target="_blank" rel="noreferrer" className="hover:underline">
          Read on Substack
        </a>
      </footer>
    </article>
  )
}
