// Read-only Substack adapter. Uses each publication's RSS feed (the documented read path),
// fetched through our /proxy/substack route because Substack sends no CORS headers.
// We don't use Substack's undocumented JSON endpoints; their terms restrict scraping.

import type { Follow } from '../db/db.ts'
import type { Page, SocialItem } from './types.ts'

const PROXY = '/proxy/substack'
const DC = 'http://purl.org/dc/elements/1.1/'
const CONTENT = 'http://purl.org/rss/1.0/modules/content/'

/**
 * Publication origin from what the user pastes: "name", "name.substack.com",
 * "https://www.example.com", or any post URL on the publication.
 */
export function parseSubstackInput(input: string): URL | null {
  const s = input.trim()
  if (!s) return null
  if (/^[a-z0-9-]+$/i.test(s)) return new URL(`https://${s.toLowerCase()}.substack.com`)
  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`)
  } catch {
    return null
  }
  // substack.com/@someone is a profile, not a publication.
  if (/^(www\.)?substack\.com$/i.test(url.hostname)) return null
  return new URL(url.origin.replace(/^http:/, 'https:'))
}

async function getFeed(origin: string): Promise<Document> {
  const res = await fetch(`${PROXY}?url=${encodeURIComponent(origin)}`)
  if (!res.ok) throw new Error((await res.text()) || `Substack feed failed (${res.status})`)
  const doc = new DOMParser().parseFromString(await res.text(), 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('Could not read that feed')
  return doc
}

const childText = (el: Element, tag: string) =>
  el.getElementsByTagName(tag)[0]?.textContent?.trim() ?? ''

export async function resolveSubstack(input: string): Promise<Follow> {
  let origin = parseSubstackInput(input)
  if (!origin) throw new Error('Paste a Substack publication address, like name.substack.com')
  let feed: Document
  try {
    feed = await getFeed(origin.origin)
  } catch (err) {
    // Custom domains often only serve the feed on www (example.com/feed → 404).
    if (origin.hostname.startsWith('www.') || origin.hostname.endsWith('.substack.com')) throw err
    origin = new URL(`https://www.${origin.hostname}`)
    feed = await getFeed(origin.origin).catch(() => Promise.reject(err))
  }
  const channel = feed.getElementsByTagName('channel')[0]
  if (!channel) throw new Error('That feed has no channel')
  const image = channel.getElementsByTagName('image')[0]
  return {
    id: `substack:${origin.hostname}`,
    source: 'substack',
    kind: 'publication',
    target: origin.origin,
    label: childText(channel, 'title') || origin.hostname,
    url: origin.origin,
    avatar: image ? childText(image, 'url') : undefined,
    addedAt: Date.now(),
  }
}

export async function fetchSubstack(follow: Follow): Promise<Page> {
  const doc = await getFeed(follow.target)
  const host = new URL(follow.target).hostname
  const items: SocialItem[] = [...doc.getElementsByTagName('item')].map((item) => {
    const link = childText(item, 'link')
    const html = item.getElementsByTagNameNS(CONTENT, 'encoded')[0]?.textContent ?? ''
    const subtitle = childText(item, 'description')
    const author = item.getElementsByTagNameNS(DC, 'creator')[0]?.textContent?.trim()
    const enclosure = item.getElementsByTagName('enclosure')[0]?.getAttribute('url')
    const pubDate = childText(item, 'pubDate')
    return {
      id: `substack:${childText(item, 'guid') || link}`,
      source: 'substack',
      author: {
        name: author ? `${author} · ${follow.label}` : follow.label,
        handle: host,
        avatar: follow.avatar,
        url: follow.url,
      },
      title: childText(item, 'title'),
      text: subtitle || excerpt(html),
      url: link,
      createdAt: new Date(pubDate || Date.now()).toISOString(),
      // Only Gutenberg links matter for book matching; don't keep every link in a long essay.
      links: [link, ...(html.match(/https?:\/\/(?:www\.)?gutenberg\.org\/[^\s"'<>]+/g) ?? [])],
      images: enclosure ? [{ thumb: enclosure, alt: '' }] : undefined,
      via: follow.label,
    }
  })
  return { items }
}

function excerpt(html: string, max = 280): string {
  const text =
    new DOMParser()
      .parseFromString(html, 'text/html')
      .body.textContent?.replace(/\s+/g, ' ')
      .trim() ?? ''
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}
