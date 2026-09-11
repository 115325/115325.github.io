import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative paths so the built site works whether it's served from
  // https://<user>.github.io/ (user/org page) or
  // https://<user>.github.io/<repo>/ (project page) — no repo name to hardcode.
  base: './',
})
