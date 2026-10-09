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
  ('通用简历', '清晰简洁的单栏布局，留白充足，适合多数行业与岗位', 'general',
   ARRAY['单栏','通用','简洁'], 1,
   '{"layout":"single-column","fonts":["Inter","system-ui"],"primaryColor":"#2563eb","accentColor":"#eef2ff","headerStyle":"underline","sections":["basic","summary","experience","projects","education","skills","awards"]}'),

  ('商务经典', '传统双栏布局，左侧信息栏、右侧主内容，适合商务与职能岗位', 'business',
   ARRAY['双栏','商务','稳重'], 2,
   '{"layout":"two-column","fonts":["Times New Roman","serif"],"primaryColor":"#1e293b","accentColor":"#f1f5f9","headerStyle":"bar","sections":["basic","summary","experience","education","skills","awards"]}'),

  ('创意设计', '以色彩和层次突出个人风格，适合视觉与创意岗位', 'design',
   ARRAY['色彩','设计','创意'], 3,
   '{"layout":"single-column","fonts":["Poppins","system-ui"],"primaryColor":"#7c3aed","accentColor":"#f3e8ff","headerStyle":"pill","sections":["basic","summary","skills","projects","experience","education"]}'),

  ('技术研发', '为研发岗位优化，重点呈现技术能力与项目成果', 'technical',
   ARRAY['研发','技术','项目'], 4,
   '{"layout":"two-column","fonts":["JetBrains Mono","Inter","system-ui"],"primaryColor":"#0f766e","accentColor":"#ecfdf5","headerStyle":"bar","sections":["basic","skills","projects","experience","education","awards"]}'),

  ('学术科研', '突出教育背景、研究经历与学术成果，适合科研和教学岗位', 'academic',
   ARRAY['学术','科研','教育'], 5,
   '{"layout":"single-column","fonts":["Georgia","serif"],"primaryColor":"#334155","accentColor":"#f8fafc","headerStyle":"underline","sections":["basic","education","summary","projects","experience","awards"]}'),

  ('商务管理', '深色标题栏与紧凑排版，适合金融、咨询与管理岗位', 'business',
   ARRAY['商务','金融','管理'], 6,
   '{"layout":"single-column","fonts":["Helvetica","Arial","system-ui"],"primaryColor":"#0f172a","accentColor":"#e2e8f0","headerStyle":"solid","sections":["basic","summary","experience","education","skills","awards"]}'),

  ('产品运营', '突出产品成果、运营策略与业务指标，适合互联网产品岗位', 'product',
   ARRAY['产品','运营','指标'], 7,
   '{"layout":"single-column","fonts":["Inter","system-ui"],"primaryColor":"#2563eb","accentColor":"#eff6ff","headerStyle":"underline","sections":["basic","summary","projects","experience","education","skills"]}'),

  ('界面设计', '留白与层次感更强，适合界面、交互与视觉设计岗位', 'design',
   ARRAY['设计','视觉','作品'], 8,
   '{"layout":"single-column","fonts":["Poppins","system-ui"],"primaryColor":"#db2777","accentColor":"#fdf2f8","headerStyle":"pill","sections":["basic","summary","projects","skills","experience","education"]}'),

  ('应届校招', '面向应届毕业生，突出实习、项目与校园经历', 'graduate',
   ARRAY['校招','应届','实习'], 9,
   '{"layout":"single-column","fonts":["Inter","system-ui"],"primaryColor":"#0284c7","accentColor":"#e0f2fe","headerStyle":"underline","sections":["basic","education","projects","experience","skills","awards"]}'),

  ('数据分析', '强调分析方法、工具与业务洞察，适合数据分析岗位', 'technical',
   ARRAY['数据','分析','指标'], 10,
   '{"layout":"two-column","fonts":["Inter","system-ui"],"primaryColor":"#0d9488","accentColor":"#ccfbf1","headerStyle":"bar","sections":["basic","summary","skills","projects","experience","education"]}'),

  ('教育教学', '适合教师、教育培训与教学管理岗位', 'academic',
   ARRAY['教育','教师','教学'], 11,
   '{"layout":"single-column","fonts":["Georgia","serif"],"primaryColor":"#b45309","accentColor":"#fef3c7","headerStyle":"underline","sections":["basic","summary","experience","education","skills","certificates"]}'),

  ('医疗健康', '适合医护、医药与健康行业，突出专业资质与工作经历', 'medical',
   ARRAY['医疗','医护','资质'], 12,
   '{"layout":"single-column","fonts":["Helvetica","Arial","system-ui"],"primaryColor":"#0369a1","accentColor":"#e0f2fe","headerStyle":"solid","sections":["basic","summary","certificates","experience","education","skills"]}')
  ON CONFLICT DO NOTHING;
