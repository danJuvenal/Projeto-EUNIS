/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true, // precisa bater com CORS_ORIGINS do backend
    // Mesma origem para o navegador: o cookie de sessão HttpOnly funciona sem CORS e o WebSocket de presença passa pelo proxy
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: false, ws: true },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: false, ws: true },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
})
