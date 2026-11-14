// Fetches a Substack publication's RSS feed for the browser (Substack sends no CORS headers).
// Shared by the Cloudflare Worker and the Vite dev server so both behave the same.
//
// Not an open proxy: only https, only the `/feed` path of the given origin, and the response
// is passed through only if Substack served it (x-served-by header or <generator>Substack).
// Custom domains (e.g. www.astralcodexten.com) are why we can't use a fixed host allowlist.

export const SUBSTACK_CACHE_SECONDS = 15 * 60
const MAX_BYTES = 5_000_000
const USER_AGENT = 'Echtra/0.1 (non-commercial reader; RSS via cached proxy)'

export async function fetchSubstackFeed(feedParam: string | null): Promise<Response> {
  let origin: URL
  try {
    origin = new URL(feedParam ?? '')
  } catch {
    return plain(400, 'Missing or invalid ?url=')
  }
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.port)
    return plain(400, 'Only plain https URLs are allowed')

  const feedUrl = new URL('/feed', origin.origin)
  let res: Response
  try {
    res = await fetch(feedUrl, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, application/xml;q=0.9' },
      redirect: 'follow',
    })
  } catch {
    return plain(502, 'Could not reach that site')
  }
  if (!res.ok) return plain(res.status === 404 ? 404 : 502, `Feed returned ${res.status}`)
  if (Number(res.headers.get('content-length') ?? 0) > MAX_BYTES)
    return plain(413, 'Feed too large')

  const body = await res.text()
  if (body.length > MAX_BYTES) return plain(413, 'Feed too large')
  const servedBySubstack = /substack/i.test(res.headers.get('x-served-by') ?? '')
  const head = body.slice(0, 5000)
  if (
    !/<rss[\s>]/i.test(head) ||
    !(servedBySubstack || /<generator>\s*Substack\s*<\/generator>/i.test(head))
  )
    return plain(422, 'That address is not a Substack publication')

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': `public, max-age=${SUBSTACK_CACHE_SECONDS}`,
      'Access-Control-Allow-Origin': '*',
    },
  })
}

function plain(status: number, message: string): Response {
  return new Response(message, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
