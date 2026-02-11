import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages公開用の設定
export default defineConfig({
  plugins: [react()],
  // GitHub Pagesでどのパスでも動くように相対パスを指定
  base: './',
  build: {
    outDir: 'dist',
  }
})

