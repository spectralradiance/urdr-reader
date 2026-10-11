// Cloudflare Worker: serves the built app + hosted library as static assets, and a small
// allowlisted, cached proxy for sources that block browser requests (CORS).
// It is deliberately NOT an open proxy: only the hosts below, GET only.

interface Env {
  ASSETS: Fetcher
}

const UPSTREAMS: Record<string, string> = {
  gutendex: 'https://gutendex.com',
  gutenberg: 'https://www.gutenberg.org',
}

const CACHE_SECONDS = 60 * 60 * 24

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    const match = url.pathname.match(/^\/proxy\/([a-z]+)(\/.*)?$/)
    if (!match) return env.ASSETS.fetch(request)

    const upstream = UPSTREAMS[match[1]]
    if (!upstream) return new Response('Unknown upstream', { status: 404 })
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 })

    const cache = caches.default
    const cacheKey = new Request(url.toString(), { method: 'GET' })
    const cached = await cache.match(cacheKey)
    if (cached) return cached

    const res = await fetch(`${upstream}${match[2] ?? '/'}${url.search}`, {
      headers: { 'User-Agent': 'Echtra/0.1 (non-commercial reader; cached proxy)' },
      cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true },
    })
    const out = new Response(res.body, res)
    out.headers.set('Cache-Control', `public, max-age=${CACHE_SECONDS}`)
    out.headers.delete('Set-Cookie')
    if (res.ok) ctx.waitUntil(cache.put(cacheKey, out.clone()))
    return out
  },
} satisfies ExportedHandler<Env>
