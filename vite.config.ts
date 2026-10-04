import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    // Split the long-lived vendor code out of the app bundle so a code change
    // does not invalidate the whole cache for returning users.
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'radix', test: /node_modules[\\/](@radix-ui|radix-ui)[\\/]/ },
            { name: 'dates', test: /node_modules[\\/](date-fns|@date-fns)[\\/]/ },
            { name: 'dnd', test: /node_modules[\\/]@dnd-kit[\\/]/ },
          ],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
})