import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// The server listens on /api/web/* itself, so the proxy passes the path through
// unchanged. It used to strip the /api prefix, back when routes were mounted at
// the root — one less mapping to get wrong. Production puts a reverse proxy in
// the same role.
const BACKEND = process.env.IDEA_BACKEND ?? 'http://localhost:3300'

// biome-ignore lint/style/noDefaultExport: vite config requires a default export
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5300,
    proxy: {
      '/api': { target: BACKEND, changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})
