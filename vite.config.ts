import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Dev stand-in for the Cloudflare Worker proxy (worker/src/index.ts).
      '/proxy/gutendex': {
        target: 'https://gutendex.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/gutendex/, ''),
      },
    },
  },
})
