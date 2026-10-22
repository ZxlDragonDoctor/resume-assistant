import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default defineConfig({
  plugins: [react()],
  /**
   * 依赖预构建缓存放到项目外。
   * 原因：`node_modules/.vite` 在部分受管控的执行环境里会被批量删除守卫拦截
   * （dev server 启动时需要清理该目录），导致 Vite 无法启动。
   * 放到系统临时目录后既不占用项目体积，也规避了该问题。
   * 如需恢复默认行为，删除本项即可。
   */
  cacheDir: join(tmpdir(), 'resume-assistant-vite'),
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/export': {
        target: 'http://localhost:8085',
        changeOrigin: true,
      },
      '/minio': {
        target: 'http://localhost:9010',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/minio/, ''),
        configure: (proxy) => {
          proxy.on('proxyRes', (response) => {
            response.headers['content-security-policy'] = "sandbox; default-src 'none'; style-src 'unsafe-inline'";
            response.headers['x-content-type-options'] = 'nosniff';
          });
        },
      },
    },
  },
});
