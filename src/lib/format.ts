/** "The Odyssey / Rendered into English prose…" → "The Odyssey" */
export function shortTitle(title: string): string {
  return title.split(/\s+\/\s+|;\s+/)[0].trim()
}

export function subtitle(title: string): string | undefined {
  const rest = title.split(/\s+\/\s+/)[1]
  return rest?.trim()
}

/** "BOOK I." → "Book I", leaves mixed-case titles alone. */
export function displayHeading(text: string): string {
  const t = text.replace(/[.:]\s*$/, '').trim()
  if (t !== t.toUpperCase() || !/[A-Z]/.test(t)) return t
  return t
    .toLowerCase()
    .replace(/(^|[\s(“"'-])(\p{L})/gu, (_, pre: string, ch: string) => pre + ch.toUpperCase())
    .replace(/\b(Of|The|And|In|On|To|A|An|Or|For|At|By|With)\b/g, (w, _1, offset: number) =>
      offset === 0 ? w : w.toLowerCase(),
    )
    .replace(/\b([IVXLC]+)\b/gi, (m) =>
      /^[ivxlc]+$/i.test(m) && m.length <= 6 ? m.toUpperCase() : m,
    )
}

/** "Homer" / "Butler, Samuel" → "Samuel Butler" */
export function authorName(name: string): string {
  const [last, first] = name.split(/,\s*/)
  return first && !/\d/.test(first) ? `${first} ${last}` : name
}

export function readingTime(words: number, wpm = 230): string {
  const minutes = Math.max(1, Math.round(words / wpm))
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
