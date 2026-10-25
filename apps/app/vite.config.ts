import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Padrão do Workbox (js, css, html) + as fontes, para funcionarem offline.
      // Ícones e manifesto entram pelo includeAssets/manifest, como antes.
      workbox: { globPatterns: ['**/*.{js,css,html,woff2}'] },
      includeAssets: ['icon.svg', 'favicon-32x32.png', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Elaps',
        short_name: 'Elaps',
        description: 'Contador de tempo de estudo e trabalho',
        lang: 'pt-BR',
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // O manifesto não varia por esquema de cor: fica o claro; o <meta theme-color> segue o tema.
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // Por fornecedor: o código do app muda a cada deploy, as libs quase nunca (melhor cache).
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules\/(react|react-dom|scheduler|react-router)\//.test(id)) return 'react';
          if (id.includes('@supabase')) return 'supabase';
          if (
            /node_modules\/(recharts|d3-|victory-vendor|decimal\.js-light|es-toolkit|immer|reselect)/.test(
              id,
            )
          )
            return 'recharts';
          if (id.includes('@radix-ui') || id.includes('radix-ui')) return 'radix';
          if (/node_modules\/(react-day-picker|date-fns)/.test(id)) return 'dates';
          return undefined;
        },
      },
    },
  },
});
