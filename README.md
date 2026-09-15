# 晓龙简历 · 在线简历工作台

一个成熟的全栈在线简历编写平台。**AI 只出建议、不代笔**；预览与 PDF 导出共用同一套渲染规则，做到真正的所见即所得。

## 核心能力

| 能力 | 说明 |
|---|---|
| **模块化编辑** | 10 种模块（基本信息 / 个人总结 / 实习 / 工作 / 项目 / 教育 / 技能 / 奖项 / 证书 / 自定义），拖拽排序、显隐、复制 |
| **三级样式覆盖** | 模板默认 < 全局布局 < 模块级配置。每个模块可独立设置标题样式（下划线/色条/胶囊/实底/无）、字号、颜色、行距、对齐 |
| **双模富文本** | 每个长文本模块可在 Markdown 与富文本之间切换，预览与导出同时支持 HTML / Markdown / 纯文本三态 |
| **AI 助手** | 内容润色、个人总结生成、ATS 简历体检、JD 解析、技能匹配、面试题预测。**未配置大模型密钥时自动降级为本地规则引擎**，功能不中断 |
| **所见即所得导出** | Puppeteer 无头 Chrome 渲染 A4 PDF，与编辑器预览使用同一套排版规则 |
| **版本管理** | 手动存档、时间线回溯、一键回退 |
| **只读分享** | 生成随机令牌链接，HR 无需登录即可查看，内容实时同步 |
| **账号体系** | JWT 认证、头像上传、密码修改 |

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Vite 5 + Ant Design 5 |
| 状态管理 | Zustand |
| 富文本 | TipTap 2 (ProseMirror) |
| 拖拽 | @dnd-kit 6/8 |
| 后端 | Java 17 + Spring Boot 3.2.5 + Spring Cloud Alibaba 2023.0.1.0 |
| ORM | MyBatis-Plus 3.5.7（UUID 主键） |
| 数据库 | PostgreSQL 16 + JSONB + pgvector |
| 服务发现 | Nacos |
| 消息队列 | RabbitMQ 3.13 |
| 缓存 | Redis 7 |
| 对象存储 | MinIO |
| PDF 导出 | Node.js + Express + Puppeteer 22 |
| AI 服务 | Python 3.11+ + FastAPI + LangChain 0.2 |

## 目录结构

```
ResumeAssistant/
├── services/                    # Java 微服务
│   ├── common/                  # 共享 DTO、R<T>、异常处理
│   ├── gateway/                 # Spring Cloud Gateway（:8080）
│   ├── auth-service/            # JWT 认证（:8081）
│   ├── resume-service/          # 简历 CRUD + JSONB（:8082）
│   ├── template-service/        # 模板管理（:8083）
│   └── file-service/            # MinIO 文件上传（:8084）
├── export-service/              # Node.js PDF 导出（:8085）
│   ├── src/renderer.js          # 渲染器（与前端预览引擎规则镜像）
│   └── scripts/contract-test.mjs # 渲染契约测试
├── ai-service/                  # Python FastAPI AI（:8086）
│   ├── app/services/ai_service.py   # LLM 优先
│   ├── app/services/rule_engine.py  # 本地规则降级
│   └── scripts/rule_engine_test.py  # 降级测试
├── frontend/                    # React 前端（:5173）
│   └── src/
│       ├── components/
│       │   ├── editor/          # 编辑器组件（受控，不直接读写 store）
│       │   ├── viewer/          # 渲染引擎 + 富文本
│       │   ├── dashboard/       # 工作台组件
│       │   ├── templates/       # 模板预览
│       │   ├── layout/          # 全局外壳
│       │   └── common/          # 通用原子组件
│       ├── pages/               # Home / Login / Dashboard / Editor / Templates / Profile / SharedResume
│       ├── services/api.ts      # Axios 封装 + 全部接口
│       ├── stores/              # resumeStore / authStore
│       ├── styles/              # tokens.ts（设计令牌唯一来源）+ global.css + components.css
│       ├── constants/sections.ts # 模块元数据
│       └── types/resume.ts      # 领域模型
├── docs/
│   ├── FRONTEND.md              # 前端设计系统规范
│   └── sql/init.sql             # 建表 + 种子数据（6 个模板）
└── docker-compose.yml           # PostgreSQL / Redis / RabbitMQ / MinIO / Nacos
```

## 快速启动

### 前置要求

Node.js 18+ · JDK 17+ · Maven 3.8+ · Docker · Python 3.11+

### 1. 基础设施

```bash
docker compose up -d
```

启动 PostgreSQL、Redis、RabbitMQ、MinIO、Nacos。

**若只想跑本项目必需的服务**（推荐，避免与其它本地服务抢占端口）：

```bash
docker compose up -d postgres nacos minio
```

> 当前 Java 服务只依赖 **PostgreSQL / Nacos / MinIO** 三者
> —— 没有任何服务的 `application.yml` 配置了 Redis 或 RabbitMQ。
> 它们是为后续异步任务预留的。

启动后可用以下命令确认就绪（两个都应返回 `200`）：

```bash
curl -o /dev/null -w "%{http_code}\n" http://localhost:4348/nacos/
curl -o /dev/null -w "%{http_code}\n" http://localhost:9100/minio/health/live
```

> **Nacos 端口是 4348 而非 8848** —— compose 里做了 `4348:8848` 映射以避免与本机已有 Nacos 冲突，
> 各服务的 `spring.cloud.nacos.discovery.server-addr` 也都写作 `localhost:4348`。
> 控制台地址：http://localhost:4348/nacos

> **MinIO 端口是 9100/9101 而非 9000/9001** —— 同样是为了避开本机已占用该端口的其它实例。
> 控制台地址：http://localhost:9101 （minioadmin / minioadmin123）。
> 如需改回默认端口，**必须同步修改**
> `docker-compose.yml` 的 minio `ports` 与 `services/file-service/src/main/resources/application.yml`
> 的 `minio.endpoint`，两处不一致会导致头像/附件上传失败。

> **首次导出 PDF 前**需安装 Puppeteer 的 Chrome：
> ```bash
> cd export-service && npx puppeteer browsers install chrome
> ```
> 未安装时导出接口会返回 `Could not find Chrome`。

### 2. Java 后端

```bash
# 必须先构建 common，其他服务依赖它
mvn clean install -pl services/common -am -DskipTests

# 按顺序启动
mvn spring-boot:run -pl services/gateway
mvn spring-boot:run -pl services/auth-service
mvn spring-boot:run -pl services/resume-service
mvn spring-boot:run -pl services/template-service
mvn spring-boot:run -pl services/file-service
```

### 3. AI 服务

```bash
cd ai-service
pip install -r requirements.txt
cp .env.example .env        # 可选：填入大模型密钥
uvicorn app.main:app --reload --port 8086
```

> **无需密钥即可运行** —— 未配置时自动使用本地规则引擎，所有 AI 功能依然可用，
> 响应中的 `engine` 字段会标记为 `rule`。

**模型配置**（改 `.env` 三个变量即可切换厂商，无需改动任何代码）：

| 厂商 | `OPENAI_BASE_URL` | `LLM_MODEL` |
|---|---|---|
| 通义千问（默认） | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-max` |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |

千问可选模型：`qwen3-max`（最新旗舰）> `qwen-max`（默认）> `qwen-plus`（均衡）> `qwen-turbo`（最快）。
Key 在[阿里云百炼控制台](https://bailian.console.aliyun.com/)申请。

AI 能力共 6 项，其中 5 项由大模型驱动、1 项为刻意设计的纯规则实现：

| 能力 | 端点 | 引擎 |
|---|---|---|
| 要点润色 | `/api/ai/optimize-bullet` | 大模型 |
| 个人总结 | `/api/ai/generate-summary` | 大模型 |
| ATS 评分 | `/api/ai/ats-score` | 大模型 |
| JD 解析 | `/api/ai/parse-jd` | 大模型 |
| 面试题预测 | `/api/ai/interview-questions` | 大模型 |
| 简历翻译 | `/api/ai/translate` | 大模型 |
| 技能匹配 | `/api/ai/match-skills` | **纯规则**（精确字符串匹配，更快更稳定，不走模型） |

除技能匹配外，其余能力在调用失败时都会自动降级到本地规则引擎，
前端不会出现空白或报错。响应中的 `engine` 字段标识实际使用的引擎：
`llm`（大模型）/ `rule`（本地规则）/ `none`（无输入）。

### 4. 导出服务

```bash
cd export-service
npm install                 # 会自动下载 Chromium
npm run dev
```

### 5. 前端

```bash
cd frontend
npm install
npm run dev
```

打开 http://localhost:5173

## 服务端口

| 服务 | 端口 |
|---|---|
| Gateway（前端统一入口） | 8080 |
| auth-service | 8081 |
| resume-service | 8082 |
| template-service | 8083 |
| file-service | 8084 |
| export-service | 8085 |
| ai-service | 8086 |
| frontend (Vite) | 5173 |

Vite 已配置代理：`/api` → `http://localhost:8080`

## API

网关统一入口 `http://localhost:8080`，响应格式 `{ code, message, data }`。

| 端点 | 服务 | 说明 |
|---|---|---|
| `POST /api/auth/register` `/login` | auth | 公开 |
| `GET/PATCH /api/auth/me` | auth | 资料读写 |
| `POST /api/auth/change-password` | auth | 改密码 |
| `/api/resumes/**` | resume | 简历 CRUD、模块、排序、版本、统计 |
| `POST /api/resumes/{id}/share` | resume | 开启分享（返回 token） |
| `GET /api/public/resumes/{token}` | resume | **公开**，只读分享 |
| `/api/templates/**` | template | 模板列表 / 分类 / 详情 |
| `/api/files/**` | file | 文件上传、头像 |
| `/api/ai/**` | ai | 6 项 AI 能力 |
| `/api/export/**` | export | PDF 导出 |

除注册、登录、`/api/public/**` 外，均需 `Authorization: Bearer <token>`。

## 测试

```bash
# 渲染契约测试（14 项）—— 保证 PDF 与预览完全一致
cd export-service && npm run test:contract

# AI 规则引擎降级测试（6 项）—— 保证无密钥时功能可用
cd ai-service && python scripts/rule_engine_test.py

# 前端类型检查 + 构建
cd frontend && npm run build
```

> **修改任一渲染器后，务必运行契约测试。**
> 详见 `docs/FRONTEND.md` 的「渲染契约」一节。

## 开发约定

- **设计令牌单一来源**：`frontend/src/styles/tokens.ts`，组件内不写魔法色值
- **渲染器必须同步**：`ResumePreviewEngine.tsx` 与 `export-service/src/renderer.js`
- **编辑器单一编排者**：`pages/Editor.tsx` 是唯一读写 store 的地方
- **`_config` 不可丢失**：内容编辑不得覆盖模块样式配置
- **A4 尺寸固定**：794 × 1123 px，缩放只作用于 `transform: scale()`

详见 `docs/FRONTEND.md`。

## 数据库

PostgreSQL，连接信息 `resume / resume123 @ localhost:5432/resume_assistant`。

表：`users`、`resumes`、`resume_sections`、`resume_versions`、`templates`、`ai_operations`

`docs/sql/init.sql` 含建表语句、触发器与 6 个种子模板。

## License

MIT
