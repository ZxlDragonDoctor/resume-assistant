-- Resume Assistant Database Initialization
-- Automatically executed by PostgreSQL on first startup

-- Enable pgvector for AI-powered semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Users
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name          VARCHAR(100) NOT NULL,
    avatar_url    VARCHAR(500),
    provider      VARCHAR(20) DEFAULT 'email',
    provider_id   VARCHAR(255),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Templates
CREATE TABLE IF NOT EXISTS templates (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(100) NOT NULL,
    description   TEXT,
    category      VARCHAR(50),
    thumbnail_url VARCHAR(500),
    is_premium    BOOLEAN DEFAULT FALSE,
    config        JSONB NOT NULL DEFAULT '{}',
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Resumes
CREATE TABLE IF NOT EXISTS resumes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           VARCHAR(200) DEFAULT '我的简历',
    template_id     UUID REFERENCES templates(id),
    target_job      VARCHAR(200),
    target_company  VARCHAR(200),
    font_family     VARCHAR(100) DEFAULT 'system-ui',
    font_size       INT DEFAULT 14,
    theme_color     VARCHAR(7) DEFAULT '#2563eb',
    layout_config   JSONB DEFAULT '{}',
    is_public       BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_resumes_user ON resumes(user_id);

-- Resume Sections (JSONB for flexible schema)
CREATE TABLE IF NOT EXISTS resume_sections (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id    UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    section_type VARCHAR(50) NOT NULL,
    sort_order   INT NOT NULL,
    is_visible   BOOLEAN DEFAULT TRUE,
    data         JSONB NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sections_resume ON resume_sections(resume_id);
CREATE INDEX IF NOT EXISTS idx_sections_type ON resume_sections(resume_id, section_type);
CREATE INDEX IF NOT EXISTS idx_sections_data ON resume_sections USING GIN(data);

-- Resume versions (snapshots)
CREATE TABLE IF NOT EXISTS resume_versions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id     UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    version_num   INT NOT NULL,
    snapshot      JSONB NOT NULL,
    description   VARCHAR(500),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(resume_id, version_num)
);

-- AI operation audit log
CREATE TABLE IF NOT EXISTS ai_operations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id),
    resume_id       UUID REFERENCES resumes(id),
    operation_type  VARCHAR(50),
    input           JSONB,
    output          JSONB,
    user_feedback   INT,
    tokens_used     INT,
    model           VARCHAR(100),
    latency_ms      INT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Seed templates
INSERT INTO templates (id, name, description, category, config) VALUES
  (gen_random_uuid(), '简约现代', '清晰简洁的单栏布局，适合大多数行业', 'modern',
   '{"layout": "single-column", "fonts": ["Inter", "system-ui"], "primaryColor": "#2563eb", "sections": ["summary", "experience", "education", "skills"]}'),
  (gen_random_uuid(), '经典稳重', '传统双栏布局，左侧个人信息右侧经历', 'classic',
   '{"layout": "two-column", "fonts": ["Times New Roman", "serif"], "primaryColor": "#1e293b", "sections": ["summary", "experience", "education", "skills"]}'),
  (gen_random_uuid(), '创意新颖', '带色彩点缀的现代版式，适合设计/创意岗位', 'creative',
   '{"layout": "single-column", "fonts": ["Poppins", "system-ui"], "primaryColor": "#7c3aed", "sections": ["summary", "experience", "education", "skills"]}')
ON CONFLICT DO NOTHING;
