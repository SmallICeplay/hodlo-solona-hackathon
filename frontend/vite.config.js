import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backendPort = process.env.BACKEND_PORT || '9000'

export default defineConfig({
  base: '/solana-hackathon/',
  plugins: [react()],
  build: {
    minify: 'esbuild',
    rollupOptions: {
      treeshake: false,
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['hodlo.ai'],
    proxy: {
      '/api': `http://127.0.0.1:${backendPort}`,
      '/ws': {
        target: `ws://127.0.0.1:${backendPort}`,
        ws: true,
      },
    },
  },
})
