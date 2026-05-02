import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import basicSSL from '@vitejs/plugin-basic-ssl'
import { fileURLToPath, URL } from 'node:url'

const resolve = (path: string) => fileURLToPath(new URL(path, import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    basicSSL({
      /** name of certification */
      name: 'test',
      /** custom trust domains */
      domains: ['vite.custom.com'],
      /** optional, days before certificate expires */
      ttlDays: 30,
      /** custom certification directory */
      certDir: '/Users/weijuer/Documents/Files/.devServer/cert'
    })
  ],

  base: '/nce-learning/',
  assetsInclude: ['**/*.mp3', '**/*.lrc'],
  resolve: {
    alias: {
      '@': resolve('src'),
      '@w-design/components': resolve('../w-design/packages/components'),
      '@w-design/*': resolve('../w-design/packages/*'),
      'w-design-vue': resolve('../w-design/packages/design-vue/index.ts'),
      Api: resolve('src/api'),
      Assets: resolve('src/assets'),
      Constant: resolve('src/constant'),
      Utils: resolve('src/utils'),
      Stores: resolve('src/stores'),
      Router: resolve('src/router'),
      Locales: resolve('src/locales'),
      Composables: resolve('src/composables'),
      Views: resolve('src/views'),
      Components: resolve('src/components'),
      Layouts: resolve('src/components/layouts'),
      Widgets: resolve('src/components/widgets'),
      Styles: resolve('src/styles'),
      Types: resolve('src/types')
    }
  },
  server: {
    // OPFS 和 Worker 要求安全上下文，localhost 自动满足
  },
  build: {
    target: 'es2023'
  }
})
