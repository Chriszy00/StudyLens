import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],

  // Use './' for Capacitor - assets are served from local files, not a server
  base: './',

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  build: {
    // Code splitting to reduce chunks and improve loading
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks - separate heavy libraries
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'query-vendor': ['@tanstack/react-query'],
          'supabase-vendor': ['@supabase/supabase-js'],
          'capacitor-vendor': ['@capacitor/core', '@capacitor/filesystem'],
        },
      },
    },
    // Increase warning limit (500kB is reasonable for mobile apps)
    chunkSizeWarningLimit: 600,
  },
})
