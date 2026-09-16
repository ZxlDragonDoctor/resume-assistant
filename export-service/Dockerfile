# ============================================================================
# export-service —— Node.js + Puppeteer 无头 Chrome 的 PDF 导出服务
# ----------------------------------------------------------------------------
# 这是整个项目最难容器化的一环：Puppeteer 需要一个真实可执行的 Chromium。
#
# 方案选择：使用 Alpine 官方 chromium 包，而不是 `npx puppeteer browsers install`。
#   优点：无需在构建期联网下载浏览器；浏览器随镜像层固定，运行时可预期；
#         体积远小于捆绑官方 Chrome 的 node 镜像。
#   代价：必须显式设置 PUPPETEER_EXECUTABLE_PATH 指向 /usr/bin/chromium-browser。
#         好在 src/index.js 第 18 行已经支持读取该环境变量，无需改代码。
#
# 为什么不能在 Serverless（Vercel / Netlify Functions）上跑：
#   无头 Chrome 体积大、依赖 glibc 共享库、需要可写的 /tmp 与足够内存，
#   超出多数免费 Serverless 函数的大小与超时限制。所以导出服务必须独立部署。
# ============================================================================

FROM node:22-alpine

# Alpine 包仓库镜像。默认走清华 —— 实测从中国大陆访问
# dl-cdn.alpinelinux.org 会**完全超时**（连不上，apk 无限挂起），
# 而清华/阿里云都是 ~0.1s 响应。不换源这一步根本跑不完。
ARG ALPINE_MIRROR=mirrors.tuna.tsinghua.edu.cn
RUN set -eux; \
    if [ -n "$ALPINE_MIRROR" ]; then \
      # 主仓库 + community（font-noto-cjk 在 community 里）
      sed -i "s|dl-cdn.alpinelinux.org|${ALPINE_MIRROR}|g" /etc/apk/repositories; \
    fi; \
    cat /etc/apk/repositories

# Chromium 及其运行时依赖；字体（中文简历 PDF 必须，否则中文渲染成方框）
RUN apk add --no-cache \
        chromium \
        nss \
        freetype \
        harfbuzz \
        ca-certificates \
        ttf-dejavu \
        ttf-freefont \
        font-noto-cjk \
        dumb-init

WORKDIR /app

# 依赖层单独缓存
COPY package.json package-lock.json* ./

# PUPPETEER_SKIP_DOWNLOAD=true：跳过 Puppeteer 自带的浏览器下载，
# 因为 postinstall 脚本会联网拉取 Chrome，我们在镜像里用系统 chromium。
# --ignore-scripts 避免 postinstall 触发下载；如需保留其它脚本可去掉此项。
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund

COPY src ./src
COPY scripts ./scripts

# PUPPETEER_EXECUTABLE_PATH 被 src/index.js:18 读取，指向镜像内的系统 chromium。
# 注意：Chrome 启动参数（--no-sandbox / --disable-dev-shm-usage）在
# src/index.js:56-61 中已硬编码，无需（也无法）通过环境变量注入。
ENV NODE_ENV=production \
    PORT=8085 \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

EXPOSE 8085

# dumb-init 作为 PID 1，正确转发信号并回收僵尸进程（Chrome 会 fork 子进程）
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js"]
