import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    // OPFS 和 Worker 要求安全上下文，localhost 自动满足
  },
})
