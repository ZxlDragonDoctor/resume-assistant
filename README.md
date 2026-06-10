# 晓龙简历 - 免费在线简历制作工具

一个功能丰富的在线简历制作平台，支持 Markdown/富文本编辑、AI 智能优化、ATS 评分、PDF 导出等功能。

## 功能特性

- 📝 **灵活编辑** — 支持 Markdown 和富文本两种编辑模式
- 🎨 **模块自定义** — 每个模块独立控制字体、字号、颜色、行间距、对齐方式
- 📐 **全局布局** — 页面边距、模块间距、字体等全局设置
- 🤖 **AI 智能优化** — AI 优化措辞，让表达更专业
- 📊 **ATS 评分** — 分析简历与岗位匹配度
- 📄 **PDF 导出** — 一键导出 A4 格式 PDF，所见即所得
- 🔄 **模块拖拽排序** — 自由调整模块顺序

## 技术栈

| 层 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite + Ant Design + TipTap |
| 状态管理 | Zustand |
| 后端 | Spring Boot 3.2 + Spring Cloud + MyBatis-Plus |
| 数据库 | PostgreSQL + pgvector |
| 服务发现 | Nacos |
| 消息队列 | RabbitMQ |
| 文件存储 | MinIO |
| 导出服务 | Node.js + Express + Puppeteer |

## 快速启动

### 前置要求

- Node.js 18+
- JDK 17+
- Maven 3.8+
- Docker & Docker Compose
- Chrome（用于 PDF 导出）

### 1. 启动基础设施 (Docker)

```bash
docker compose up -d
```

启动 PostgreSQL、Redis、Nacos、MinIO、RabbitMQ。

### 2. 启动后端服务

```bash
# 构建所有模块
mvn clean package -DskipTests

# 启动各微服务（按顺序）
java -jar services/auth-service/target/auth-service-1.0.0-SNAPSHOT.jar &
java -jar services/resume-service/target/resume-service-1.0.0-SNAPSHOT.jar &
java -jar services/template-service/target/template-service-1.0.0-SNAPSHOT.jar &
java -jar services/file-service/target/file-service-1.0.0-SNAPSHOT.jar &
java -jar services/gateway/target/gateway-1.0.0-SNAPSHOT.jar &
```

### 3. 启动前端

```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:5173

### 4. 启动导出服务

```bash
cd export-service
npm install
npm start
```

导出服务运行在 http://localhost:8085

## 项目结构

```
resume-assistant/
├── frontend/                    # React 前端
│   ├── src/
│   │   ├── components/         # 组件
│   │   │   ├── common/         # 通用组件 (AuthGuard, Navbar)
│   │   │   ├── editor/         # 编辑器组件
│   │   │   └── viewer/         # 预览组件
│   │   ├── pages/              # 页面 (Home, Login, Dashboard, Editor)
│   │   ├── services/           # API 服务
│   │   ├── stores/             # Zustand 状态管理
│   │   └── types/              # TypeScript 类型
│   └── ...
├── services/                    # Java 微服务
│   ├── auth-service/           # 认证服务
│   ├── resume-service/         # 简历 CRUD 服务
│   ├── template-service/       # 模板服务
│   ├── file-service/           # 文件上传服务
│   ├── gateway/                # Spring Cloud Gateway
│   └── common/                 # 公共模块
├── export-service/             # Node.js PDF 导出服务
└── docs/                       # 文档
```

## API 文档

网关统一入口：`http://localhost:8080`

| 端点 | 服务 | 说明 |
|------|------|------|
| `/api/auth/**` | auth-service | 注册、登录 |
| `/api/resumes/**` | resume-service | 简历 CRUD |
| `/api/templates/**` | template-service | 模板列表 |
| `/api/files/**` | file-service | 文件上传 |
| `/api/export/**` | export-service | PDF 导出 |

## License

MIT
