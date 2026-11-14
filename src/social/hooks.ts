import { useQueries } from '@tanstack/react-query'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Follow } from '../db/db.ts'
import { fetchFollow } from './sources.ts'
import type { SocialItem } from './types.ts'

export function useFollows(): Follow[] | undefined {
  return useLiveQuery(() => db.follows.orderBy('addedAt').toArray(), [])
}

/** First page of every follow, merged newest-first. Polls only while mounted. */
export function useMergedTimeline(follows: Follow[] | undefined) {
  const results = useQueries({
    queries: (follows ?? []).map((follow) => ({
      queryKey: ['social', follow.id],
      queryFn: () => fetchFollow(follow),
      staleTime: 5 * 60_000,
      refetchInterval: 10 * 60_000,
    })),
  })

  const seen = new Set<string>()
  const items: SocialItem[] = []
  for (const r of results)
    for (const item of r.data?.items ?? []) {
      const key = item.url
      if (!seen.has(key)) {
        seen.add(key)
        items.push(item)
      }
    }
  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return {
    items,
    loading: results.some((r) => r.isLoading),
    errors: results.flatMap((r, i) =>
      r.error && follows ? [{ follow: follows[i], message: r.error.message }] : [],
    ),
    refetch: () => results.forEach((r) => r.refetch()),
  }
}
