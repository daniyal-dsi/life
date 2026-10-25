import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  // VITE_* is our own naming. NEXT_PUBLIC_SUPABASE_* is what the Vercel-Supabase
  // integration creates; those are the public URL and key, safe for the browser.
  // Server-only values (SUPABASE_SERVICE_ROLE_KEY, POSTGRES_*) never match these.
  envPrefix: ['VITE_', 'NEXT_PUBLIC_SUPABASE_'],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    rollupOptions: {
      output: { manualChunks: (id) => (id.includes('@zxing') ? 'barcode' : undefined) }
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/icon.svg', 'push-sw.js', 'data/cofid-2021.json'],
      manifest: {
        name: 'Life Organiser',
        short_name: 'Life',
        description: 'Health, work, faith and family planning in one place.',
        start_url: '/',
        display: 'standalone',
        background_color: '#F4F2EE',
        theme_color: '#121117',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      // push-sw.js adds the push and notification-click handlers.
      workbox: {
        navigateFallback: '/index.html',
        importScripts: ['push-sw.js'],
        // The barcode scanner is large and only loaded when scanning: keep it out
        // of the install download and cache it the first time it's used.
        globIgnores: ['**/barcode-*.js'],
        runtimeCaching: [{ urlPattern: /\/assets\/barcode-.*\.js$/, handler: 'CacheFirst', options: { cacheName: 'barcode-scanner' } }]
      }
    })
  ]
});
