import { defineConfig } from 'vite'

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/gravity-defied-web/' : '/',
  server: {
    port: 3000,
    fs: {
      allow: ['..'],
    },
  },
})
