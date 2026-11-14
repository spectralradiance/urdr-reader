import { useState } from 'react'
import { bookUrl } from '../books/hosted.ts'
import { authorName, shortTitle } from '../lib/format.ts'

const HUES = [18, 32, 145, 200, 228, 265, 340, 5]

/** Book cover image, or a typographic stand-in when there isn't one. */
export function Cover({
  book,
  className = '',
}: {
  book: { id: string; title: string; authors: string[]; cover?: string }
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  if (book.cover && !failed) {
    return (
      <img
        src={bookUrl(book.id, book.cover)}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className={`aspect-[2/3] w-full rounded-md object-cover shadow-sm ring-1 ring-border ${className}`}
      />
    )
  }
  const hue = HUES[[...book.id].reduce((n, c) => n + c.charCodeAt(0), 0) % HUES.length]
  return (
    <div
      className={`flex aspect-[2/3] w-full flex-col justify-between rounded-md p-3 text-left shadow-sm ring-1 ring-border ${className}`}
      style={{ background: `hsl(${hue} 35% 28%)`, color: `hsl(${hue} 40% 92%)` }}
      aria-hidden
    >
      <span className="line-clamp-5 font-serif text-sm leading-snug font-semibold">
        {shortTitle(book.title)}
      </span>
      <span className="line-clamp-2 text-[11px] opacity-80">
        {book.authors.map(authorName).join(', ')}
      </span>
    </div>
  )
}
