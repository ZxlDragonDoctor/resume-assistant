# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

### Infrastructure (Docker)
```bash
docker compose up -d          # start PostgreSQL, Redis, RabbitMQ, MinIO, Nacos
```
Wait for Nacos at http://localhost:8848 before starting Java services.

### Java Services (Spring Boot 3.2, JDK 17)
```bash
mvn clean install -pl services/common -am -DskipTests   # build shared lib first
mvn spring-boot:run -pl services/gateway                # port 8080
mvn spring-boot:run -pl services/auth-service           # port 8081
mvn spring-boot:run -pl services/resume-service         # port 8082
mvn spring-boot:run -pl services/template-service       # port 8083
mvn spring-boot:run -pl services/file-service           # port 8084
```
**Startup order matters**: Nacos → Gateway → other services.

### Frontend (React + Vite + TypeScript)
```bash
cd frontend && npm install && npm run dev   # port 5173
npm run build                                # production build (tsc + vite)
```

### AI Service (Python FastAPI + LangChain)
```bash
cd ai-service && pip install -r requirements.txt
# copy .env.example to .env and fill OPENAI_API_KEY
uvicorn app.main:app --reload --port 8086  # port 8086
```

### Export Service (Node.js + Puppeteer)
```bash
cd export-service && npm install && npm run dev   # port 8085
```

## Architecture Overview

Monorepo with 3 tech stacks across 6 services:

### Frontend (`frontend/`)
- React 18 + TypeScript + Vite + Ant Design 5 + Zustand + TipTap editor
- `src/types/resume.ts` — core TypeScript types (Resume, ResumeSection, ResumeDetail, Template, etc.)
- `src/stores/resumeStore.ts` — Zustand store for resume CRUD + local section updates with optimistic UI
- `src/services/api.ts` — Axios client, auto-attaches JWT, auto-redirects on 401
- `src/pages/Editor.tsx` — main 3-panel editor layout: LeftPanel (sortable section list via @dnd-kit), CenterPanel (section content editor), right Sider (ResumePreview)
- `src/components/editor/CenterPanel.tsx` — per-module styling config (title/content fontSize, titleColor, textColor, lineSpacing, textAlign, markdown toggle). Content auto-saves with 500ms debounce.
- Per-module config stored in `_config` key within section JSONB data

### Backend — Java (`services/`)
- **`common/`** — shared DTOs, `R<T>` response wrapper, `@UserId` annotation with `UserIdArgumentResolver`, `GlobalExceptionHandler`, custom MyBatis type handlers (UUID, JSONB)
- **`gateway/`** — Spring Cloud Gateway, JWT validation via `JwtAuthGlobalFilter`, forwards `X-UserId` header to downstream services
- **`auth-service/`** — JWT auth (Spring Data JPA), register/login
- **`resume-service/`** — Resume CRUD with MyBatis-Plus, JSONB sections
- **`template-service/`** — template listing
- **`file-service/`** — MinIO file upload
- All services register with Nacos for discovery
- PostgreSQL with UUID PKs. GIN index on `resume_sections.data` for JSONB querying
- 6 tables: `users`, `templates`, `resumes`, `resume_sections`, `resume_versions`, `ai_operations`
- JWT secret shared across gateway and auth-service

### AI Service (`ai-service/`)
- Python FastAPI + LangChain with 通义千问 Qwen (OpenAI-compatible) via ChatOpenAI
- 6 endpoints: `optimize-bullet` (STAR-format rewrite), `generate-summary`, `ats-score` (5-dimension scoring), `parse-jd`, `match-skills`, `interview-questions`
- Every LLM call degrades to a local rule engine on failure; responses carry `engine: 'llm' | 'rule' | 'none'`

### Export Service (`export-service/`)
- Node.js + Express + Puppeteer — renders resume HTML to A4 PDF
- Two modes: HTTP direct (`POST /export/direct` — returns PDF blob) and RabbitMQ async (via `export_tasks` queue, uploads to MinIO)
- Template HTML generated inline in `src/index.js` with per-section layout handling

### Database (`docs/sql/init.sql`)
- PostgreSQL 16 with pgvector extension
- Seed data: 3 templates (简约现代, 经典稳重, 创意新颖) inserted on first startup
- Connection: `resume / resume123` on `localhost:5432/resume_assistant`

## Key Conventions

- **API response format**: `{ code: 200, message: "success", data: ... }` via `R<T>`
- **Auth**: JWT in `Authorization: Bearer <token>` header; `/api/auth/register` and `/api/auth/login` are public
- **UserId propagation**: Gateway extracts userId from JWT → forwards as `X-UserId` header → microservices resolve via `@RequestAttribute UUID userId` (handled by `UserIdArgumentResolver` in common module)
- **UUID PKs** everywhere — MyBatis-Plus uses `id-type: INPUT`, manually set via `UUID.randomUUID()`
- **Frontend proxy**: Vite proxies `/api` → `localhost:8080` (gateway)
- **Per-section styling**: `_config` key in each section's JSONB stores per-module font, color, spacing, alignment, markdown mode
- **No linting/formatting configured** — no ESLint, Prettier, or Checkstyle
- **Export/AI** have both sync HTTP endpoints and async RabbitMQ paths available

## Common Gotchas

- **AI service** needs a `.env` file with `OPENAI_API_KEY`. Defaults to 通义千问 DashScope (`https://dashscope.aliyuncs.com/compatible-mode/v1`, model `qwen-max`); switch providers by editing `OPENAI_BASE_URL` + `LLM_MODEL` only — no code change needed. Never commit real keys.
- **Export service** needs Chromium — `npm run postinstall` downloads it. Set `PUPPETEER_SKIP_DOWNLOAD=false` if skipped.
- **Build common first**: `mvn clean install -pl services/common -am -DskipTests` before building other services
- **Nacos port**: configured at `localhost:4348` (mapped from container port 8848)
- **Frontend builds** via `tsc && vite build` — TypeScript errors will block production builds
