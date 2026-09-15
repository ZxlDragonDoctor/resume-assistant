-- ============================================================
--  Resume Assistant · Database Initialization
--  Automatically executed by PostgreSQL on first startup
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ------------------------------------------------------------
-- Users
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name          VARCHAR(100) NOT NULL,
    avatar_url    VARCHAR(500),
    phone         VARCHAR(50),
    provider      VARCHAR(20) DEFAULT 'email',
    provider_id   VARCHAR(255),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Templates
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS templates (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(100) NOT NULL,
    description   TEXT,
    category      VARCHAR(50),
    tags          TEXT[] DEFAULT '{}',
    thumbnail_url VARCHAR(500),
    preview_config JSONB DEFAULT '{}',
    is_premium    BOOLEAN DEFAULT FALSE,
    is_active     BOOLEAN DEFAULT TRUE,
    sort_order    INT DEFAULT 0,
    config        JSONB NOT NULL DEFAULT '{}',
    created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_active ON templates(is_active, sort_order);

-- ------------------------------------------------------------
-- Resumes
-- ------------------------------------------------------------
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
    line_spacing    NUMERIC(4,2) DEFAULT 1.6,
    layout_config   JSONB DEFAULT '{}',
    share_token     VARCHAR(64) UNIQUE,
    share_enabled   BOOLEAN DEFAULT FALSE,
    is_public       BOOLEAN DEFAULT FALSE,
    view_count      INT DEFAULT 0,
    status          VARCHAR(20) DEFAULT 'draft',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_resumes_user ON resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_resumes_share ON resumes(share_token) WHERE share_token IS NOT NULL;

-- ------------------------------------------------------------
-- Resume Sections (JSONB for flexible schema)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS resume_sections (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id    UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    section_type VARCHAR(50) NOT NULL,
    sort_order   INT NOT NULL,
    is_visible   BOOLEAN DEFAULT TRUE,
    layout       VARCHAR(20) DEFAULT 'single-column',
    data         JSONB NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sections_resume ON resume_sections(resume_id);
CREATE INDEX IF NOT EXISTS idx_sections_type ON resume_sections(resume_id, section_type);
CREATE INDEX IF NOT EXISTS idx_sections_data ON resume_sections USING GIN(data);

-- ------------------------------------------------------------
-- Resume versions (snapshots)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS resume_versions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id     UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    version_num   INT NOT NULL,
    label         VARCHAR(100),
    snapshot      JSONB NOT NULL,
    description   VARCHAR(500),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(resume_id, version_num)
);
CREATE INDEX IF NOT EXISTS idx_versions_resume ON resume_versions(resume_id, version_num DESC);

-- ------------------------------------------------------------
-- AI operation audit log
-- ------------------------------------------------------------
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
CREATE INDEX IF NOT EXISTS idx_ai_ops_user ON ai_operations(user_id, created_at DESC);

-- ------------------------------------------------------------
-- Trigger: keep updated_at fresh
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_resumes_touch ON resumes;
CREATE TRIGGER trg_resumes_touch BEFORE UPDATE ON resumes
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_sections_touch ON resume_sections;
CREATE TRIGGER trg_sections_touch BEFORE UPDATE ON resume_sections
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ------------------------------------------------------------
-- Seed templates
-- ------------------------------------------------------------
INSERT INTO templates (name, description, category, tags, sort_order, config) VALUES
  ('简约现代', '清晰简洁的单栏布局，留白充足，适合大多数行业与岗位', 'modern',
   ARRAY['单栏','通用','极简'], 1,
   '{"layout":"single-column","fonts":["Inter","system-ui"],"primaryColor":"#2563eb","accentColor":"#eef2ff","headerStyle":"underline","sections":["basic","summary","experience","projects","education","skills","awards"]}'),

  ('经典稳重', '传统双栏布局，左侧信息栏右侧主内容，稳重专业', 'classic',
   ARRAY['双栏','国企','传统'], 2,
   '{"layout":"two-column","fonts":["Times New Roman","serif"],"primaryColor":"#1e293b","accentColor":"#f1f5f9","headerStyle":"bar","sections":["basic","summary","experience","education","skills","awards"]}'),

  ('创意新颖', '带色彩点缀的现代版式，适合设计、产品与创意岗位', 'creative',
   ARRAY['色彩','设计','创意'], 3,
   '{"layout":"single-column","fonts":["Poppins","system-ui"],"primaryColor":"#7c3aed","accentColor":"#f3e8ff","headerStyle":"pill","sections":["basic","summary","skills","projects","experience","education"]}'),

  ('技术极客', '为研发岗位优化，突出技术栈与项目成果', 'technical',
   ARRAY['研发','技术','项目'], 4,
   '{"layout":"two-column","fonts":["JetBrains Mono","Inter","system-ui"],"primaryColor":"#0f766e","accentColor":"#ecfdf5","headerStyle":"bar","sections":["basic","skills","projects","experience","education","awards"]}'),

  ('学术简约', '适合科研、教学与升学申请，突出教育背景与发表', 'academic',
   ARRAY['学术','科研','升学'], 5,
   '{"layout":"single-column","fonts":["Georgia","serif"],"primaryColor":"#334155","accentColor":"#f8fafc","headerStyle":"underline","sections":["basic","education","summary","projects","experience","awards"]}'),

  ('商务精英', '深色标题栏 + 紧凑排版，适合金融、咨询、管理岗位', 'business',
   ARRAY['商务','金融','管理'], 6,
   '{"layout":"single-column","fonts":["Helvetica","Arial","system-ui"],"primaryColor":"#0f172a","accentColor":"#e2e8f0","headerStyle":"solid","sections":["basic","summary","experience","education","skills","awards"]}')
ON CONFLICT DO NOTHING;
