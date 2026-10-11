// Dispatches follows to their source adapter.

import type { Follow } from '../db/db.ts'
import { fetchFollow as fetchBluesky, resolveFollow as resolveBluesky } from './bluesky.ts'
import { fetchSubstack, resolveSubstack } from './substack.ts'
import type { Page, SocialItem } from './types.ts'

export type SourceId = SocialItem['source']

export const SOURCES: Record<SourceId, { label: string; placeholder: string; hint: string }> = {
  bluesky: {
    label: 'Bluesky',
    placeholder: '@handle or bsky.app link',
    hint: 'Accounts, custom feeds (…/feed/…) and lists (…/lists/…) all work.',
  },
  substack: {
    label: 'Substack',
    placeholder: 'name.substack.com or site URL',
    hint: 'Any Substack publication, including custom domains. Reads its public RSS feed.',
  },
}

export function resolveFollow(source: SourceId, input: string): Promise<Follow> {
  return source === 'substack' ? resolveSubstack(input) : resolveBluesky(input)
}

export function fetchFollow(follow: Follow): Promise<Page> {
  return follow.source === 'substack' ? fetchSubstack(follow) : fetchBluesky(follow)
}
