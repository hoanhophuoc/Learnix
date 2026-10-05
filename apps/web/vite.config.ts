/// <reference types="vitest/config" />
import path from 'path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      compiler: true,
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    // Target modern browsers for smaller output
    target: 'esnext',
    // Enable minification with esbuild (fastest)
    minify: 'esbuild',
    // Generate source maps for production debugging
    sourcemap: false,
    // Optimize chunk size
    chunkSizeWarningLimit: 500,
    // CSS optimization
    cssMinify: true,
    cssCodeSplit: true,
    // Rollup options for advanced optimization
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        manualChunks(id: string) {
          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/react-dom/') ||
            id.includes('/node_modules/react-router-dom/')
          ) {
            return 'react-vendor';
          }
          if (id.includes('/node_modules/@tanstack/react-query/')) {
            return 'query-vendor';
          }
          if (id.includes('/node_modules/@radix-ui/')) {
            return 'ui-vendor';
          }
          if (
            id.includes('/node_modules/@tiptap/') ||
            id.includes('/node_modules/tiptap-markdown/')
          ) {
            return 'editor-vendor';
          }
          if (id.includes('/node_modules/@dnd-kit/')) {
            return 'dnd-vendor';
          }
          if (
            id.includes('/node_modules/react-hook-form/') ||
            id.includes('/node_modules/@hookform/resolvers/') ||
            id.includes('/node_modules/zod/')
          ) {
            return 'form-vendor';
          }
          if (
            id.includes('/node_modules/clsx/') ||
            id.includes('/node_modules/tailwind-merge/')
          ) {
            return 'utils';
          }
        },
        // Optimize chunk file names for caching
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.') ?? [];
          const ext = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext ?? '')) {
            return 'assets/images/[name]-[hash][extname]';
          }
          if (/woff2?|eot|ttf|otf/i.test(ext ?? '')) {
            return 'assets/fonts/[name]-[hash][extname]';
          }
          if (ext === 'css') {
            return 'assets/css/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
      // Tree-shake unused exports
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
      },
    },
    // Report compressed size
    reportCompressedSize: true,
  },
  // Optimize dependencies pre-bundling
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
      'axios',
    ],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
