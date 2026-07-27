import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// The server owns routes at the root (`/health`, not `/api/health`), so the dev
// proxy strips the prefix. Production puts a reverse proxy in the same role.
const BACKEND = process.env.IDEA_BACKEND ?? 'http://localhost:3300'

// biome-ignore lint/style/noDefaultExport: vite config requires a default export
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5300,
    proxy: {
      '/api': { target: BACKEND, changeOrigin: true, rewrite: p => p.replace(/^\/api/, '') },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})
