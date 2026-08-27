import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '여행 가계부',
        short_name: '여행 가계부',
        description: '여행 중 공금과 개인 결제를 함께 기록하는 가계부',
        lang: 'ko',
        theme_color: '#2A6B5C',
        background_color: '#EDEFE7',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        share_target: {
          action: '/share-target',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            files: [
              // image/* 를 넣어야 공유 시트에 안정적으로 뜬다. 구체 타입만 적으면
              // 캡쳐를 image/* 로 넘기는 앱에서 목록에 아예 안 나온다.
              { name: 'images', accept: ['image/*', 'image/jpeg', 'image/png', 'image/webp'] },
            ],
          },
        } as never,
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
})
