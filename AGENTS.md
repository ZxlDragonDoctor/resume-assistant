# AGENTS.md — Resume Assistant (v2)

## Architecture

```
resume-assistant/            ← monorepo root
├── services/                ← Java Spring Boot microservices
│   ├── common/              ← shared DTOs, R<T>, exception handler
│   ├── gateway/             ← Spring Cloud Gateway (port 8080)
│   ├── auth-service/        ← JWT auth (port 8081)
│   ├── resume-service/      ← Resume CRUD + PostgreSQL JSONB (port 8082)
│   ├── template-service/    ← Template management (port 8083)
│   └── file-service/        ← MinIO file upload (port 8084)
├── export-service/          ← Node.js Puppeteer PDF export (port 8085)
├── ai-service/              ← Python FastAPI + LangChain AI (port 8086)
├── frontend/                ← React + Vite + Ant Design (port 5173)
└── docker-compose.yml       ← PostgreSQL, Redis, RabbitMQ, MinIO, Nacos
```

## Build & run

### Infrastructure (Docker)
```bash
docker compose up -d          # start all: postgres, redis, rabbitmq, minio, nacos
```

Wait for Nacos to be ready at http://localhost:8848 before starting services.

### Java services (in order)
```bash
mvn clean install -pl services/common -am -DskipTests   # build shared lib first
mvn spring-boot:run -pl services/gateway                # gateway on :8080
mvn spring-boot:run -pl services/auth-service           # auth on :8081
mvn spring-boot:run -pl services/resume-service         # resume on :8082
mvn spring-boot:run -pl services/template-service       # template on :8083
mvn spring-boot:run -pl services/file-service           # file on :8084
```

### Export service (Node.js)
```bash
cd export-service && npm install && npm run dev         # :8085
```

### AI service (Python)
```bash
cd ai-service && pip install -r requirements.txt
# copy .env.example to .env and fill OPENAI_API_KEY
uvicorn app.main:app --reload --port 8086               # :8086
```

### Frontend
```bash
cd frontend && npm install && npm run dev               # :5173
```

Open http://localhost:5173 and log in / register.

## Framework versions

| Layer | Technology | Version |
|---|---|---|
| JDK | OpenJDK | 17 |
| Spring Boot | 3.2.5 | Jakarta |
| Spring Cloud Alibaba | 2023.0.1.0 | Nacos discovery |
| Database | PostgreSQL 16 | pgvector extension |
| ORM | MyBatis-Plus 3.5.7 | UUID PK strategy |
| Frontend | React 18 + Vite + Ant Design 5 | TypeScript |
| Editor | TipTap 2 | ProseMirror JSON output |
| DnD | @dnd-kit 6/8 | Sortable preset |
| PDF | Puppeteer 22 | Isolated Node.js service |
| AI | Python FastAPI + LangChain 0.2 | DeepSeek / OpenAI |
| Queue | RabbitMQ 3.13 | Export/AI async tasks |
| Cache | Redis 7 | Sessions |
| File | MinIO | S3-compatible |

## Database

- **PostgreSQL** with JSONB for flexible resume sections
- Tables: `users`, `resumes`, `resume_sections`, `resume_versions`, `templates`, `ai_operations`
- GIN index on `resume_sections.data` for JSONB querying
- Seed data: 3 initial templates inserted by `docs/sql/init.sql`
- Connection: `resume / resume123` on `localhost:5432/resume_assistant`

## Key conventions

- **UUID PKs** everywhere — MyBatis-Plus `ASSIGN_UUID` strategy
- **UserId propagation**: Gateway forwards JWT userId as request header `X-UserId`; microservices parse via `@RequestAttribute UUID userId` (resolved from common module)
- **API response format**: `{ code: 200, message: "success", data: ... }` via `R<T>`
- **Auth**: JWT in `Authorization: Bearer <token>` header; `/api/auth/register` and `/api/auth/login` are public
- **Frontend proxy**: Vite proxies `/api` → `localhost:8080` (gateway)
- **Export/AI** are async via RabbitMQ — POST returns `taskId`, client polls/SSE for completion

## Gotchas

- **Startup order matters**: Nacos → Gateway → other services. Services will fail to register if Nacos is down.
- **Service POMs** reference `services/common` as a sibling module. Always build common first: `mvn install -pl services/common -am -DskipTests`
- **AI service** needs `.env` file with `OPENAI_API_KEY` — see `ai-service/app/core/config.py`
- **Export service** launches headless Chrome via Puppeteer. Make sure Chromium is installed (or set `PUPPETEER_SKIP_DOWNLOAD=false` in npm install)
- **Frontend** `.prettierrc` / ESLint not configured — no lint step
- **Old v1 scaffold** (`src/`) has been removed; old `pom.xml` replaced by new multi-module pom
