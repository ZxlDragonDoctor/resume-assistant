# 部署指南（Deployment）

本项目有两种部署形态，按需求选择：

| 形态 | 包含内容 | 适用平台 | 费用 |
|---|---|---|---|
| **A. 仅前端** | 前端静态站（后端指向你已有的地址） | Vercel / Netlify / Cloudflare Pages | 免费 |
| **B. 全栈容器** | 前端 + 全部 8 个服务 + 5 个中间件 | 任意支持 Docker 的容器主机 | 通常需付费 |

> **为什么全栈没有免费方案？**
> 导出服务依赖 Puppeteer 无头 Chromium（体积大、需要可写 /tmp、需要足够内存），
> Java 微服务 5 个 + Nacos + PostgreSQL + Redis + RabbitMQ + MinIO，
> 合计内存需求远超任何免费 Serverless 平台的上限。
> 免费平台无法承载，这是架构决定的，不是配置问题。

---

## A. 仅前端部署（免费）

前端已做好静态托管适配，**无需任何代码改动**。

### 前置：配置后端地址

Vite 在构建时把环境变量内联进产物，因此必须在构建前设置。在部署平台的
环境变量面板里配置：

```
VITE_API_BASE_URL   = https://你的后端网关地址      # 例如 https://api.example.com
VITE_EXPORT_BASE_URL= https://你的导出服务地址      # 例如 https://export.example.com
```

留空则使用相对路径（适用于「前端与后端同域、由反向代理分流」的场景）。

### 方式 1：Vercel

```bash
npm i -g vercel
cd frontend
vercel            # 首次会引导登录与初始化
vercel --prod
```

仓库根目录的 `frontend/vercel.json` 已配置好：
构建命令 `npm run build`、产物目录 `dist`、SPA 重写规则、静态资源强缓存。

也可直接在 Vercel 控制台导入 Git 仓库，**Root Directory 填 `frontend`**。

### 方式 2：Netlify

仓库根目录的 `netlify.toml` 已配置 `base = "frontend"`、`publish = "dist"`
和 200 全量重定向（等价于 SPA fallback）。直接导入 Git 仓库即可。

### 方式 3：Cloudflare Pages

构建命令 `npm run build`，输出目录 `dist`，环境变量同上。

### 必须注意的两个坑

1. **SPA 刷新 404**
   `/editor/:id`、`/share/:token` 这类前端路由必须回退到 `index.html`。
   本项目提供的 `vercel.json` / `netlify.toml` 已经处理；
   若用其它平台，请自行配置 history fallback，否则刷新页面会 404。

2. **后端必须允许前端域名跨域**
   前端静态托管与后端不同域时，浏览器会拦截请求。
   网关的允许来源可通过环境变量配置：

   ```
   CORS_ALLOWED_ORIGINS = https://你的前端域名,http://localhost:5173
   ```

---

## B. 全栈容器部署

### 本地一键起全栈

```bash
# 1. 复制并填写环境变量（不提交进仓库）
cp .env.example .env
#    编辑 .env：至少改 JWT_SECRET，并按需填 OPENAI_API_KEY
#    生成 JWT 密钥：openssl rand -base64 48

# 2. 构建并启动全部服务
docker-compose up -d --build

# 3. 查看状态
docker-compose ps
```

启动后访问：

| 服务 | 地址 |
|---|---|
| 前端（nginx） | http://localhost:8000 |
| 网关 API | http://localhost:8080 |
| Nacos 控制台 | http://localhost:4348/nacos |
| MinIO 控制台 | http://localhost:9101 |
| RabbitMQ 控制台 | http://localhost:15672 |
| AI 服务文档 | http://localhost:8086/docs |

> 首次构建需要下载 Maven / Node / pip 依赖，耗时较长（10~30 分钟，取决于网速）。

### 架构与请求链路

```
浏览器
  └─ http://localhost:8000  (frontend: nginx)
       ├─ /            → 静态文件（React 打包产物）
       ├─ /api/ai/**   → ai-service:8086      （先匹配合，避免被 /api/ 抢走）
       ├─ /export/**   → export-service:8085  （该服务路由无 /api 前缀）
       └─ /api/**      → gateway:8080
                          ├─ lb://auth-service      (Nacos 服务发现)
                          ├─ lb://resume-service
                          ├─ lb://template-service
                          ├─ lb://file-service
                          ├─ http://ai-service:8086
                          └─ http://export-service:8085
```

**前端与后端同源**，由 nginx 在服务端转发，因此**完全不需要 CORS 配置**。

### 配置覆盖机制（重要）

各服务的 `application.yml` 里写的是 `localhost`（本机开发用）。
容器内 `localhost` 指向容器自己，无法访问其它服务。

本项目**没有修改这些 yml 的默认值**，而是利用 Spring Boot 的
宽松绑定（relaxed binding）通过环境变量覆盖：

| 环境变量 | 等价配置项 |
|---|---|
| `SPRING_CLOUD_NACOS_DISCOVERY_SERVER_ADDR` | `spring.cloud.nacos.discovery.server-addr` |
| `SPRING_DATASOURCE_URL` | `spring.datasource.url` |
| `JWT_SECRET` | `jwt.secret` |
| `DB_USERNAME` / `DB_PASSWORD` | `spring.datasource.username` / `password` |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | `minio.access-key` / `secret-key` |
| `MINIO_ENDPOINT` | `minio.endpoint` |

这样本机开发与容器部署共用同一份配置，互不污染。

`gateway` 的 `application.yml` 中，AI / 导出地址与 CORS 来源已改为
**带默认值的占位符**（`${AI_SERVICE_URL:http://localhost:8086}`），
本机运行时行为与之前完全一致。

---

## 部署到容器云平台

需要一台支持 Docker + docker compose 的主机。常见选择：

| 平台 | 说明 |
|---|---|
| **腾讯云 / 阿里云轻量服务器** | 2C4G 起，最省心，适合本项目 |
| **Railway / Render** | 支持 Dockerfile，但多服务 + 中间件会很快超出免费额度 |
| **自有服务器 / NAS** | 完全可控 |

部署步骤：

```bash
# 在服务器上
git clone <你的仓库地址> && cd ResumeAssistant
cp .env.example .env
# 编辑 .env：JWT_SECRET 用 openssl rand -base64 48 生成，按需填 OPENAI_API_KEY
docker-compose up -d --build
```

若要对外提供 HTTPS，推荐在前端容器前再挂一层反向代理
（如 Caddy / Nginx Proxy Manager / 宝塔面板）自动签发证书。

---

## ⚠️ 在「国内服务器」上构建必读

**这一节是实测踩出来的，跳过会浪费大量时间。**

本项目从中国大陆的服务器上构建时，**最大的障碍不是代码，而是拉不到包**。
三处官方源基本不可用，已在各 Dockerfile 中默认改为国内镜像
（全部是 `ARG`，境外环境可传空值回退官方源）：

| 生态 | 官方源实测表现 | 默认已改用 | 所在文件 |
|---|---|---|---|
| Maven | `repo.maven.apache.org` **仅 25~60 KB/s** | `maven.aliyun.com/repository/public` | `services/Dockerfile` |
| Alpine | `dl-cdn.alpinelinux.org` **完全超时** | `mirrors.tuna.tsinghua.edu.cn` | `export-service/`、`frontend/` |
| PyPI | pypi.org 慢 | `pypi.tuna.tsinghua.edu.cn` | `ai-service/Dockerfile` |
| npm | registry.npmjs.org 慢 | `registry.npmmirror.com` | `frontend/Dockerfile` |

效果对比：改之前单个 Java 模块十几分钟都跑不完；
改之后 5 个 Java 服务合计约 **3.5 分钟**全部构建完。

回退到官方源（境外环境）：

```bash
docker compose build \
  --build-arg MAVEN_MIRROR= \
  --build-arg ALPINE_MIRROR= \
  --build-arg PIP_INDEX_URL=https://pypi.org/simple
```

### 三个必须避开的坑

1. **`--mount=type=cache,target=/root/.m2` 会遮蔽镜像内的 `/root/.m2`。**
   所以把 `settings.xml` 写到 `/root/.m2/settings.xml` **等于没写**，
   Maven 仍会去官方 central。必须放 `/opt/maven-settings.xml` 并用
   `mvn -s /opt/maven-settings.xml` 显式指定。

2. **RabbitMQ 3.13 已废弃 `RABBITMQ_VM_MEMORY_HIGH_WATERMARK`。**
   设置后容器**直接启动失败退出**（`error: deprecated environment variables
   detected`）。内存水位只能写配置文件，见 `docs/conf/rabbitmq.conf`。

3. **compose 的 `profiles` 不能用来「关掉」被依赖的服务。**
   给 rabbitmq 加 `profiles: ["disabled"]` 会让 `export-service` 的
   `depends_on` 直接报 `depends on undefined service`，整个项目连解析都过不了。
   （另外 `export-service/src/index.js` 确实在用 amqplib，
   **RabbitMQ 不能省略**；只想减端口用 `ports: !override []`。）

### 低内存主机（≤2GB）

用 `docker-compose.server.yml` 覆盖层：

```bash
docker compose -f docker-compose.yml -f docker-compose.server.yml up -d
```

它做了这些事：给每个容器设 `mem_limit`、各 Java 服务用小堆 + SerialGC、
关掉不需要的宿主端口映射。

- **Nacos 必须用 `JVM_XMS/JVM_XMX/JVM_XMN/JVM_MS/JVM_MMS`** ——
  官方镜像的 `docker-startup.sh` **不读 `JAVA_OPTIONS`**，
  写错变量名会被静默忽略，Nacos 会沿用默认 `-Xms1g -Xmx1g`，
  在小容器里疯狂 GC 卡死。
- **构建务必串行**。并行构建会同时跑多个 Maven（每个约 500MB），
  直接打爆小内存机器。参考串行构建脚本的思路（见下）。

### 上线前检查清单

- [ ] 复制 `.env.example` 为 `.env`，`JWT_SECRET` 已改为随机强密钥（禁止使用仓库默认值）
- [ ] `DB_PASSWORD`、`MINIO_ROOT_PASSWORD`、`RABBITMQ_PASSWORD` 已改为强密码
- [ ] `OPENAI_API_KEY` 通过平台 Secrets / `.env` 注入，**不写进镜像、不提交仓库**
- [ ] Nacos 已开启鉴权（`NACOS_AUTH_ENABLE=true`）并修改默认账号
- [ ] `CORS_ALLOWED_ORIGINS` 只放行你的真实前端域名
- [ ] 仓库已设为 **Private**（若历史提交中含个人信息，见下方说明）

---

## 安全与隐私提醒

### 历史提交中的个人信息

仓库早期提交曾包含一份真实简历 PDF（含姓名、手机号、邮箱等）。
即使后续用 `git rm --cached` 从最新提交中移除，**历史提交里仍然存在**：

```bash
# 查看该文件的历史
git log --all --oneline -- "*.pdf"

# 方案 1（推荐）：把仓库设为 Private —— 最省事，立即生效
#   GitHub → Settings → 底部 Danger Zone → Change visibility → Private

# 方案 2：重写历史彻底抹除（会改变所有 commit hash，需强制推送）
git filter-repo --path "Java后端春招补录版.pdf" --invert-paths
git push --force --all

# 方案 3：删除仓库重建（最彻底，但丢失 issue / star 等）
```

**仅删除文件是不够的** —— 这是最容易被忽略的一点。

### 已加入 .gitignore 的规则

```
*.pdf          # 含真实信息的导出物
*.docx / *.doc
个人简历* / 简历* / 我的简历* / resume_export*
.workbuddy-ai/ # 本地记忆文件（可能含姓名、路径）
.idea/
tmp/           # 调试产物
export-service/shots/
```

---

## 常见问题

**Q：导出 PDF 报「无法连接导出服务」**
检查 export-service 容器是否存活：`docker-compose logs export-service`。
若在容器内报 Chromium 启动失败，确认镜像内路径：
`docker-compose exec export-service ls -l /usr/bin/chromium-browser`

**Q：Java 服务启动后注册不上 Nacos**
Nacos 必须**先**就绪。本 compose 已用 `depends_on: condition: service_healthy`
保证顺序；若手动启动，请等 Nacos 健康后再起应用服务。

**Q：前端构建后接口 404**
说明 `VITE_API_BASE_URL` / `VITE_EXPORT_BASE_URL` 未设置或设置错误。
注意这两个值**只在构建时生效**，改完必须重新构建。

**Q：中文在 PDF 里显示成方框**
镜像缺中文字体。本项目已在 export-service 镜像中安装 `font-noto-cjk`；
若自定义镜像，请确保安装 CJK 字体。
