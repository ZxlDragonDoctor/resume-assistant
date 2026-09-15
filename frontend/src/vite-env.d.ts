/// <reference types="vite/client" />

/**
 * 前端环境变量类型声明。
 *
 * 开发环境留空即可（走 Vite 代理）；
 * 部署到静态托管时在平台后台配置这两个变量指向真实后端。
 */
interface ImportMetaEnv {
  /** 网关地址，例如 https://your-gateway.example.com（代码会自动补 /api） */
  readonly VITE_API_BASE_URL?: string;
  /** export-service 地址，例如 https://your-export.example.com */
  readonly VITE_EXPORT_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
