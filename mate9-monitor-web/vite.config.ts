import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    host: true,
    proxy: {
      // 开发时把 /api 转发到 mate9 上的采集服务，可用 VITE_API_TARGET 覆盖
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://192.168.31.234:3100',
        changeOrigin: true,
      },
    },
  },
})
