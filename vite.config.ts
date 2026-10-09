import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

// En GitHub Pages la app vive en /shelf-life/: el workflow de deploy pasa
// BASE_PATH. En desarrollo (y en cualquier hosting en la raíz) es '/'.
const base = process.env.BASE_PATH ?? '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  build: {
    rolldownOptions: {
      output: {
        // Librerías en chunks propios: cambian mucho menos que el código de la
        // app, así que tras cada deploy el teléfono solo vuelve a bajar lo
        // que realmente cambió.
        codeSplitting: {
          groups: [
            { name: 'supabase', test: /node_modules[\\/]@supabase/ },
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
            },
          ],
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Shelf Life',
        short_name: 'Shelf Life',
        description: 'Tus juegos, películas, series y libros en un solo lugar',
        lang: 'es',
        theme_color: '#14091f',
        background_color: '#14091f',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Assets estáticos precacheados. Los datos de Supabase NUNCA pasan por
        // el service worker (siempre red).
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        runtimeCaching: [
          {
            // Portadas de IGDB y de Steam: no cambian para una misma URL, así
            // que se sirven desde cache (instantáneas y disponibles offline).
            urlPattern: ({ url }) =>
              url.hostname === 'images.igdb.com' ||
              url.hostname.endsWith('.steamstatic.com') ||
              url.hostname.endsWith('.steampowered.com') ||
              url.hostname === 'image.tmdb.org' ||
              url.hostname === 's4.anilist.co' ||
              url.hostname === 'covers.openlibrary.org' ||
              url.hostname === 'books.google.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'game-images',
              // Las respuestas opacas ocupan bastante cuota en Chrome: límite
              // moderado y purga automática si el navegador se queda sin espacio.
              expiration: {
                maxEntries: 300,
                maxAgeSeconds: 60 * 60 * 24 * 60,
                purgeOnQuotaError: true,
              },
              // 0 = respuestas opacas (imágenes cross-origin sin CORS).
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
