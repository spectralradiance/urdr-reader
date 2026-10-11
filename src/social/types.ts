export type SocialItem = {
  id: string
  source: 'bluesky' | 'substack'
  author: { name: string; handle: string; avatar?: string; url: string }
  text: string
  url: string
  createdAt: string
  /** Links found in the post (facets + external embed), for book matching. */
  links: string[]
  embed?: { title: string; description?: string; url: string; thumb?: string }
  images?: { thumb: string; alt: string }[]
  stats?: { likes: number; reposts: number; replies: number }
  repostedBy?: string
  /** Substack post title; `text` holds the subtitle or an excerpt. */
  title?: string
  /** Which follow produced this item. */
  via?: string
}

export type Page = { items: SocialItem[]; cursor?: string }
