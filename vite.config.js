import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 部署到 GitHub Pages 時，網站網址會是 https://你的帳號.github.io/repo名稱/
// 所以下面 base 要填「/repo名稱/」，前後都要有斜線。
// 例如 repo 叫 growth-dashboard，就填 '/growth-dashboard/'
export default defineConfig({
  plugins: [react()],
  base: '/data-robot/',
})
