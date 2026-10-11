// Read-only Bluesky adapter over the public AppView (no login, CORS-enabled).
// Author, feed and list timelines are public; post search is not (see docs/PLAN.md).

import type { Follow } from '../db/db.ts'
import type { Page, SocialItem } from './types.ts'

const API = 'https://public.api.bsky.app/xrpc'

async function xrpc<T>(method: string, params: Record<string, string | number | undefined>): Promise<T> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined) qs.set(k, String(v))
  const res = await fetch(`${API}/${method}?${qs}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message ?? `Bluesky ${method} failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

// ---- Parsing what the user pastes ------------------------------------------------------------

type ParsedTarget =
  | { kind: 'author'; actor: string }
  | { kind: 'feed' | 'list'; actor: string; rkey: string }

export function parseBlueskyInput(input: string): ParsedTarget | null {
  const s = input.trim()
  const at = s.match(/^at:\/\/([^/]+)\/app\.bsky\.(feed\.generator|graph\.list)\/([^/?#]+)/)
  if (at) return { kind: at[2] === 'graph.list' ? 'list' : 'feed', actor: at[1], rkey: at[3] }
  const web = s.match(/bsky\.app\/profile\/([^/?#]+)(?:\/(feed|lists)\/([^/?#]+))?/)
  if (web) {
    if (!web[2]) return { kind: 'author', actor: web[1] }
    return { kind: web[2] === 'lists' ? 'list' : 'feed', actor: web[1], rkey: web[3] }
  }
  const handle = s.replace(/^@/, '')
  if (/^did:[a-z]+:[\w.:%-]+$/.test(handle) || /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(handle)) return { kind: 'author', actor: handle }
  return null
}

type Profile = { did: string; handle: string; displayName?: string; avatar?: string }

/** Turn a handle, profile URL, feed URL or list URL into a stored Follow. */
export async function resolveFollow(input: string): Promise<Follow> {
  const target = parseBlueskyInput(input)
  if (!target) throw new Error('Paste a Bluesky handle, or a profile, feed or list link from bsky.app')
  const profile = await xrpc<Profile>('app.bsky.actor.getProfile', { actor: target.actor })
  const base = { source: 'bluesky' as const, addedAt: Date.now() }

  if (target.kind === 'author') {
    return {
      ...base,
      id: `bluesky:author:${profile.did}`,
      kind: 'author',
      target: profile.did,
      label: profile.displayName || `@${profile.handle}`,
      url: `https://bsky.app/profile/${profile.handle}`,
    }
  }
  if (target.kind === 'feed') {
    const uri = `at://${profile.did}/app.bsky.feed.generator/${target.rkey}`
    const { view } = await xrpc<{ view: { displayName: string } }>('app.bsky.feed.getFeedGenerator', { feed: uri })
    return {
      ...base,
      id: `bluesky:feed:${uri}`,
      kind: 'feed',
      target: uri,
      label: view.displayName,
      url: `https://bsky.app/profile/${profile.handle}/feed/${target.rkey}`,
    }
  }
  const uri = `at://${profile.did}/app.bsky.graph.list/${target.rkey}`
  const { list } = await xrpc<{ list: { name: string } }>('app.bsky.graph.getList', { list: uri, limit: 1 })
  return {
    ...base,
    id: `bluesky:list:${uri}`,
    kind: 'list',
    target: uri,
    label: list.name,
    url: `https://bsky.app/profile/${profile.handle}/lists/${target.rkey}`,
  }
}

// ---- Timelines -------------------------------------------------------------------------------

type External = { uri: string; title: string; description?: string; thumb?: string }
type Images = { thumb: string; alt: string }[]

type FeedViewPost = {
  post: {
    uri: string
    author: Profile
    record: {
      text?: string
      createdAt: string
      facets?: { features: { $type: string; uri?: string }[] }[]
    }
    embed?: { $type: string; external?: External; images?: Images; media?: { images?: Images; external?: External } }
    likeCount?: number
    repostCount?: number
    replyCount?: number
  }
  reason?: { $type: string; by?: Profile }
}

const METHODS = {
  author: ['app.bsky.feed.getAuthorFeed', 'actor'],
  feed: ['app.bsky.feed.getFeed', 'feed'],
  list: ['app.bsky.feed.getListFeed', 'list'],
} as const

export async function fetchFollow(follow: Follow, cursor?: string, limit = 30): Promise<Page> {
  if (follow.kind === 'publication') throw new Error('Not a Bluesky follow')
  const [method, key] = METHODS[follow.kind]
  const res = await xrpc<{ feed: FeedViewPost[]; cursor?: string }>(method, {
    [key]: follow.target,
    limit,
    cursor,
    filter: follow.kind === 'author' ? 'posts_no_replies' : undefined,
  })
  return { items: res.feed.map((item) => normalize(item, follow.label)), cursor: res.cursor }
}

function normalize({ post, reason }: FeedViewPost, via: string): SocialItem {
  const rkey = post.uri.split('/').pop()
  const external = post.embed?.external ?? post.embed?.media?.external
  const images = post.embed?.images ?? post.embed?.media?.images
  const facetLinks = (post.record.facets ?? []).flatMap((f) => f.features.flatMap((x) => (x.uri ? [x.uri] : [])))
  return {
    id: post.uri + (reason?.by ? `:repost:${reason.by.did}` : ''),
    source: 'bluesky',
    author: {
      name: post.author.displayName || post.author.handle,
      handle: post.author.handle,
      avatar: post.author.avatar,
      url: `https://bsky.app/profile/${post.author.handle}`,
    },
    text: post.record.text ?? '',
    url: `https://bsky.app/profile/${post.author.handle}/post/${rkey}`,
    createdAt: post.record.createdAt,
    links: [...facetLinks, ...(external ? [external.uri] : [])],
    embed: external && { title: external.title, description: external.description, url: external.uri, thumb: external.thumb },
    images: images?.map((i) => ({ thumb: i.thumb, alt: i.alt })),
    stats: { likes: post.likeCount ?? 0, reposts: post.repostCount ?? 0, replies: post.replyCount ?? 0 },
    repostedBy: reason?.by ? reason.by.displayName || reason.by.handle : undefined,
    via,
  }
}
