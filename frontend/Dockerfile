# ============================================================================
# frontend —— React + Vite + Ant Design，构建为静态文件后用 nginx 托管
# ----------------------------------------------------------------------------
# 【关键】Vite 在「构建时」把 import.meta.env.VITE_* 内联进产物，
#       所以后端地址必须通过 build ARG 传入，运行时再改环境变量是无效的。
#       见 src/services/api.ts 中 API_BASE / EXPORT_BASE 的读取逻辑。
#
# nginx 配置额外承担一件事：SPA history fallback。
#   /editor/:id、/share/:token 这类前端路由在静态托管上直接刷新会 404，
#   必须把所有未命中的路径回退到 /index.html。
# ============================================================================

# ---------- 阶段 1：构建 ----------
FROM node:22-alpine AS builder

WORKDIR /app

# 后端地址在构建期注入。默认留空 = 使用相对路径，
# 配合 nginx 反向代理（见下方 nginx.conf）可做到同源，免 CORS。
ARG VITE_API_BASE_URL=""
ARG VITE_EXPORT_BASE_URL=""
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL} \
    VITE_EXPORT_BASE_URL=${VITE_EXPORT_BASE_URL}

COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

# ---------- 阶段 2：托管 ----------
FROM nginx:1.27-alpine

# 时区
RUN apk add --no-cache tzdata curl \
    && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && echo "Asia/Shanghai" > /etc/timezone

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fsS http://127.0.0.1/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
