import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // GitHub Pages는 /ski-cctv/ 아래에 올라가므로 상대 경로를 쓴다.
  base: './',
  plugins: [vue()],
  test: { environment: 'jsdom', css: true },
})
