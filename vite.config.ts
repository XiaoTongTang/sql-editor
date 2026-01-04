import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'
import vscode from '@tomjs/vite-plugin-vscode';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag: string) => tag.startsWith('vscode-'),
        },
      },
    }),
    vueJsx(),
    vueDevTools(),
    vscode({
      extension: {
        minify: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  build: {
    minify: false,
    rollupOptions: {
      input: [path.resolve(__dirname, 'index.html'), path.resolve(__dirname, 'index2.html')],
      output: {
        // https://rollupjs.org/configuration-options/#output-manualchunks
        manualChunks: (id) => {
          if (id.includes('pixi.js')) {
            return 'pixi';
          }
        },
      },
    },
  },
})
