import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Change BASE to match your GitHub Pages repo name
// e.g. if hosted at https://staedi.github.io/fin-explorer → '/fin-explorer/'
const BASE = process.env.VITE_BASE_PATH ?? '/sec-edgar-vite'

export default defineConfig({
  plugins: [react()],
  base: BASE,
})
