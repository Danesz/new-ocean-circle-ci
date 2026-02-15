import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/circleci': {
        target: 'https://circleci.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/circleci/, '/api/v2'),
      },
    },
  },
})
