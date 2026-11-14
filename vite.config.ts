import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { fetchSubstackFeed } from './worker/substack.ts'

/** Dev stand-in for the Worker's /proxy/substack route (same code path). */
function substackProxy(): Plugin {
  return {
    name: 'echtra-substack-proxy',
    configureServer(server) {
      server.middlewares.use('/proxy/substack', (req, res, next) => {
        const respond = async () => {
          const params = new URL(req.url ?? '', 'http://localhost').searchParams
          const out = await fetchSubstackFeed(params.get('url'))
          res.statusCode = out.status
          out.headers.forEach((value, key) => res.setHeader(key, value))
          res.end(await out.text())
        }
        // Connect ignores returned promises: pass failures on, or the request hangs.
        respond().catch(next)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), substackProxy()],
  server: {
    proxy: {
      // Dev stand-in for the Cloudflare Worker proxy (worker/index.ts).
      '/proxy/gutendex': {
        target: 'https://gutendex.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/gutendex/, ''),
      },
    },
  },
})
