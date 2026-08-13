import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// package.json is the single source of truth for the version shown in the app.
const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8'),
) as { version: string };

// GitHub Pages serves the app from /<repo>/ rather than the domain root.
// The deploy workflow sets BASE_PATH; everywhere else this stays '/'.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-maskable.svg'],
      manifest: {
        name: 'Cost Estimation and Quantity Takeoff Services',
        short_name: 'Cost & Takeoff',
        description:
          'ถอดแบบประมาณราคา วัดขนาด พื้นที่ และปริมาณวัสดุจากแบบก่อสร้าง พร้อมส่งออก BOQ เป็น Excel/PDF',
        lang: 'th',
        theme_color: '#0ea5e9',
        background_color: '#0b1220',
        display: 'standalone',
        // start_url and scope are left to the plugin so they follow `base` automatically.
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,woff,woff2,ttf}'],
        // ตัวอ่าน IFC เป็น JS 3.5 MB + wasm 1.3 MB แต่ 3D เป็นฟีเจอร์เสริมที่แทบไม่มีใครเปิด
        // ถ้าปล่อยให้เข้า precache ผู้ใช้ทุกคนต้องโหลดตั้งแต่ติดตั้งแอป ทั้งที่ .wasm ไม่ได้เข้าอยู่ดี
        // (globPatterns ไม่มี wasm) จึงใช้ออฟไลน์ไม่ได้แม้แคชไว้ — ตัดทิ้งทั้งคู่ ให้โหลดตอนใช้จริง
        globIgnores: ['**/web-ifc-api-*.js'],
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // ExcelJS ships a Node-oriented entry point; the pre-built browser bundle
      // avoids pulling `stream`/`buffer` polyfills into the app.
      exceljs: 'exceljs/dist/exceljs.min.js',
    },
  },

  // Baked in at build time so the running app can report exactly which build it is.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },

  // pdf.js ships its worker as an ESM file that must not be pre-bundled.
  // web-ifc is WASM glue code — esbuild's pre-bundling rewrites its module layout
  // and the runtime then fails to locate the .wasm file.
  optimizeDeps: { exclude: ['pdfjs-dist', 'web-ifc'] },

  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          konva: ['konva', 'react-konva'],
          pdfjs: ['pdfjs-dist'],
          three: ['three'],
        },
      },
    },
  },

  server: { port: 5173, host: true },
});
