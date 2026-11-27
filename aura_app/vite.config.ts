import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 900 },
  plugins: [
    react(),
    // App instalable (móvil y escritorio) y usable sin conexión
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['aura.svg'],
      manifest: {
        name: 'Aura · Personas y tiempo',
        short_name: 'Aura',
        description: 'Fichaje con geolocalización, ausencias y nóminas',
        lang: 'es',
        start_url: './#/home',
        display: 'standalone',
        background_color: '#f7f7fb',
        theme_color: '#6d5dfc',
        icons: [{ src: 'aura.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
        shortcuts: [
          { name: 'Fichar', url: './#/clock' },
          { name: 'Ausencias', url: './#/timeoff' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg}'],
        globIgnores: ['ocr/**'],
        maximumFileSizeToCacheInBytes: 3_000_000,
        runtimeCaching: [
          { urlPattern: /^https:\/\/tile\.openstreetmap\.org\//, handler: 'CacheFirst', options: { cacheName: 'tiles', expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 14 } } },
          { urlPattern: /\/ocr\//, handler: 'CacheFirst', options: { cacheName: 'ocr' } },
          { urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//, handler: 'StaleWhileRevalidate', options: { cacheName: 'fonts' } },
        ],
      },
    }),
  ],
})
