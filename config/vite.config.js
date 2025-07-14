import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

export default defineConfig({
  plugins: [vue()],
  root: resolve(__dirname, '../client'),
  resolve: {
    alias: {
      '@': resolve(__dirname, '../client/src')
    }
  },
  css: {
    postcss: {
      plugins: [
        tailwindcss({
          config: resolve(__dirname, './tailwind.config.js')
        }),
        autoprefixer()
      ]
    }
  },
  server: {
    port: 5173,
    host: '0.0.0.0', // Bind to all interfaces for Docker
    hmr: {
      host: 'localhost', // Use localhost for browser HMR connection
      port: 5173,
    },
    watch: {
      usePolling: true,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      },
      '/health': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      },
      '/ping': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: '../dist',
    assetsDir: 'assets'
  }
}) 