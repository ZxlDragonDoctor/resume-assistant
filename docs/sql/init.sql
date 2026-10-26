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

-- Resume updated_at is the content revision used for optimistic saves.
-- Views and sharing settings do not edit the document. Explicit timestamp
-- touches (manual save and legacy section writes) still advance the revision.
CREATE OR REPLACE FUNCTION touch_resume_content_revision() RETURNS trigger AS $$
BEGIN
    IF ROW(NEW.title, NEW.template_id, NEW.target_job, NEW.target_company,
           NEW.font_family, NEW.font_size, NEW.theme_color, NEW.line_spacing,
           NEW.layout_config, NEW.status)
       IS DISTINCT FROM
       ROW(OLD.title, OLD.template_id, OLD.target_job, OLD.target_company,
           OLD.font_family, OLD.font_size, OLD.theme_color, OLD.line_spacing,
           OLD.layout_config, OLD.status)
       OR NEW.updated_at IS DISTINCT FROM OLD.updated_at THEN
        NEW.updated_at = GREATEST(clock_timestamp(),
            COALESCE(OLD.updated_at, '-infinity'::timestamptz) + INTERVAL '1 microsecond');
    ELSE
        NEW.updated_at = OLD.updated_at;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_resumes_touch ON resumes;
CREATE TRIGGER trg_resumes_touch BEFORE UPDATE ON resumes
    FOR EACH ROW EXECUTE FUNCTION touch_resume_content_revision();

DROP TRIGGER IF EXISTS trg_sections_touch ON resume_sections;
CREATE TRIGGER trg_sections_touch BEFORE UPDATE ON resume_sections
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ------------------------------------------------------------
-- Seed templates
-- ------------------------------------------------------------
-- BEGIN GENERATED TEMPLATE CATALOG
-- Generated by scripts/sync-template-catalog.mjs; edit templates/catalog/*.json instead.
-- Applies to existing databases and new installations; existing resume content is untouched.
BEGIN;
SELECT pg_advisory_xact_lock(727031, 24);
DO $template_catalog$
DECLARE
    seed jsonb;
    matched_ids uuid[];
    target_id uuid;
BEGIN
    FOR seed IN SELECT value FROM jsonb_array_elements($catalog_json$
[
  {
    "key": "general-career",
    "name": "通用社招·经历清晰",
    "description": "项目协调专员原创范文，适用于1–3 年。交付节点、客户服务、流程记录；含可编辑完整经历与项目，示例内容请替换为真实经历。",
    "category": "general",
    "tags": [
      "项目协调专员",
      "1–3 年",
      "单栏",
      "交付节点",
      "客户服务"
    ],
    "sortOrder": 1,
    "legacyNames": [
      "通用简历"
    ],
    "config": {
      "systemKey": "general-career",
      "layout": "single-column",
      "fonts": [
        "Noto Sans SC",
        "Microsoft YaHei",
        "system-ui"
      ],
      "primaryColor": "#2563eb",
      "accentColor": "#2563eb12",
      "headerStyle": "underline",
      "sections": [
        "basic",
        "summary",
        "experience",
        "projects",
        "education",
        "skills",
        "custom"
      ],
      "globalFontSize": 13,
      "globalLineSpacing": 1.55,
      "pageTopMargin": 36,
      "pageBottomMargin": 36,
      "pageLeftMargin": 38,
      "pageRightMargin": 38,
      "moduleMargin": 14,
      "titleTopPadding": 4,
      "titleBottomMargin": 7
    },
    "sample": {
      "version": 1,
      "profile": {
        "key": "general-career",
        "jobTitle": "项目协调专员",
        "experienceLevel": "1–3 年",
        "highlights": [
          "交付节点",
          "客户服务",
          "流程记录"
        ],
        "suggestedPages": 1
      },
      "sections": [
        {
          "sectionType": "basic",
          "data": {
            "name": "林予安",
            "jobTitle": "项目协调专员",
            "city": "杭州",
            "phone": "138****1001",
            "email": "yuan.lin@example.com",
            "links": [],
            "_config": {
              "moduleName": "基本信息"
            }
          },
          "sortOrder": 0,
          "layout": "auto"
        },
        {
          "sectionType": "summary",
          "data": {
            "content": "2023 年起从事企业服务项目协调，围绕客户需求、实施排期与交付资料开展日常工作。能够把模糊诉求整理为明确事项，维护责任人与截止时间，持续跟进客户反馈。曾参与办公服务开通与服务台改进，习惯用记录和复盘帮助团队减少遗漏。",
            "_config": {
              "moduleName": "职业概述"
            }
          },
          "sortOrder": 1,
          "layout": "auto"
        },
        {
          "sectionType": "experience",
          "data": {
            "items": [
              {
                "company": "澄光企业服务（虚构）",
                "position": "项目协调专员",
                "startDate": "2024-04",
                "endDate": "",
                "current": true,
                "bullets": [
                  "负责 6 家企业客户的服务开通排期，将场地、设备和人员准备拆为 32 项检查任务，每周向客户同步待办及风险。",
                  "整理邮件与服务台中的重复需求，建立分类、受理和回访规则；对超期事项逐一确认原因，支持团队按约定时间交付。",
                  "维护会议纪要、变更单及验收资料，对照合同检查交付范围，提前识别 4 次新增需求，交由负责人确认费用与排期。"
                ]
              },
              {
                "company": "远帆商旅服务（虚构）",
                "position": "客户服务助理",
                "startDate": "2023-11",
                "endDate": "2024-03",
                "current": false,
                "bullets": [
                  "处理企业客户的预订修改与账单咨询，记录诉求、承诺时点和处理结果，将需升级的异常交给值班负责人。",
                  "汇总每周约 60 条服务记录，标记发票信息缺失和重复确认问题，参与改写受理表的必填提示与客户说明。",
                  "协助新人熟悉业务流程，整理 15 个常见问题及示例答复，通过同事复核后纳入班组交接手册。"
                ]
              }
            ],
            "_config": {
              "moduleName": "工作经历"
            }
          },
          "sortOrder": 2,
          "layout": "auto"
        },
        {
          "sectionType": "projects",
          "data": {
            "items": [
              {
                "name": "客户服务开通资料标准化",
                "role": "协调与文档整理",
                "startDate": "2024-09",
                "endDate": "2025-01",
                "current": false,
                "tech": "任务拆解 · 验收清单",
                "bullets": [
                  "复盘 8 次开通记录，定位资料版本不一致和签字遗漏两类问题，与实施负责人共同定义交付检查点。",
                  "将客户信息、设备清单和验收表关联到统一目录，保留变更时间与责任人，方便交接时核对最新版本。",
                  "选择 3 个新客户试行，在每次交付后收集意见；两轮调整后，资料补交事项从首轮的 9 项减少到末轮的 3 项。"
                ]
              }
            ],
            "_config": {
              "moduleName": "项目实践"
            }
          },
          "sortOrder": 3,
          "layout": "auto"
        },
        {
          "sectionType": "education",
          "data": {
            "items": [
              {
                "school": "江城管理学院（虚构）",
                "major": "行政管理",
                "degree": "本科",
                "startDate": "2019-09",
                "endDate": "2023-06",
                "current": false,
                "description": "相关课程：管理学、组织行为学、应用统计与商务沟通。毕业实践围绕社区服务窗口办理流程，完成访谈记录、问题分类和改进建议。"
              }
            ],
            "_config": {
              "moduleName": "教育背景"
            }
          },
          "sortOrder": 4,
          "layout": "auto"
        },
        {
          "sectionType": "skills",
          "data": {
            "items": [
              {
                "name": "项目协作",
                "items": [
                  "任务分解",
                  "排期与风险记录",
                  "会议纪要"
                ]
              },
              {
                "name": "办公应用",
                "items": [
                  "Excel 常用函数与透视表",
                  "Word 长文档",
                  "演示文稿"
                ]
              },
              {
                "name": "服务执行",
                "items": [
                  "需求澄清",
                  "客户回访",
                  "交付资料管理"
                ]
              }
            ],
            "_config": {
              "moduleName": "业务技能"
            }
          },
          "sortOrder": 5,
          "layout": "auto"
        },
        {
          "sectionType": "custom",
          "data": {
            "content": "在班组复盘中整理“受理前确认信息—处理中同步进度—完成后核对结果”的服务记录模板，保留客户原始表述与后续决定。对无法按期处理的事项先说明原因和下一步时点，避免使用笼统的完成承诺；每月抽取记录复查，持续完善交接说明。",
            "_config": {
              "moduleName": "服务改进记录"
            }
          },
          "sortOrder": 6,
          "layout": "auto"
        }
      ]
    }
  },
  {
    "key": "business-analyst",
    "name": "商业分析·经营洞察",
    "description": "商业分析师原创范文，适用于3–5 年。经营模型、渠道诊断、决策支持；含可编辑完整经历与项目，示例内容请替换为真实经历。",
    "category": "business",
    "tags": [
      "商业分析师",
      "3–5 年",
      "双栏",
      "经营模型",
      "渠道诊断"
    ],
    "sortOrder": 2,
    "legacyNames": [
      "商务经典"
    ],
    "config": {
      "systemKey": "business-analyst",
      "layout": "two-column",
      "fonts": [
        "Noto Sans SC",
        "Microsoft YaHei",
        "system-ui"
      ],
      "primaryColor": "#1e293b",
      "accentColor": "#1e293b12",
      "headerStyle": "bar",
      "sections": [
        "basic",
        "summary",
        "experience",
        "projects",
        "education",
        "skills",
        "custom"
      ],
      "globalFontSize": 13,
      "globalLineSpacing": 1.55,
      "pageTopMargin": 36,
      "pageBottomMargin": 36,
      "pageLeftMargin": 38,
      "pageRightMargin": 38,
      "moduleMargin": 14,
      "titleTopPadding": 4,
      "titleBottomMargin": 7
    },
    "sample": {
      "version": 1,
      "profile": {
        "key": "business-analyst",
        "jobTitle": "商业分析师",
        "experienceLevel": "3–5 年",
        "highlights": [
          "经营模型",
          "渠道诊断",
          "决策支持"
        ],
        "suggestedPages": 2
      },
      "sections": [
        {
          "sectionType": "basic",
          "data": {
            "name": "沈思衡",
            "jobTitle": "商业分析师",
            "city": "上海",
            "phone": "138****1002",
            "email": "siheng.shen@example.com",
            "links": [],
            "_config": {
              "moduleName": "基本信息"
            }
          },
          "sortOrder": 0,
          "layout": "auto"
        },
        {
          "sectionType": "summary",
          "data": {
            "content": "2022 年起从事零售经营与商业分析，能够围绕收入、毛利和库存拆解业务问题，结合交易数据与一线访谈检验假设。熟悉经营复盘和情景测算，重视口径、成本假设与结论边界，支持业务负责人判断方案的实施优先级。",
            "_config": {
              "moduleName": "职业概述"
            }
          },
          "sortOrder": 1,
          "layout": "left"
        },
        {
          "sectionType": "experience",
          "data": {
            "items": [
              {
                "company": "知衡零售集团（虚构）",
                "position": "商业分析师",
                "startDate": "2023-09",
                "endDate": "",
                "current": true,
                "bullets": [
                  "负责 28 家门店的月度经营分析，统一销售净额、折扣与可比店口径，向区域负责人解释毛利变化和门店差异。",
                  "针对低效促销回溯 12 周交易与费用，区分客流、客单价和商品组合影响，提出分门店试行的折扣边界。",
                  "与财务核对租金、人效和损耗等成本，建立开店测算表，以保守、基准和增长三种场景讨论回收周期。"
                ]
              },
              {
                "company": "原点商业咨询（虚构）",
                "position": "分析助理",
                "startDate": "2022-07",
                "endDate": "2023-08",
                "current": false,
                "bullets": [
                  "参与区域消费研究，采集并复核 40 个商圈样本，将来源、日期和缺失项记录到资料底表，支持团队交叉核验。",
                  "整理客户访谈与竞品资料，将渠道价格差异归为促销、规格和服务三类因素，避免直接比较不可比商品。",
                  "负责两份项目报告的数据附录与图表校验，在交付前逐项回查计算过程，使结论可追溯至原始资料。"
                ]
              }
            ],
            "_config": {
              "moduleName": "工作经历"
            }
          },
          "sortOrder": 2,
          "layout": "right"
        },
        {
          "sectionType": "projects",
          "data": {
            "items": [
              {
                "name": "会员促销投入产出复盘",
                "role": "分析执行",
                "startDate": "2024-05",
                "endDate": "2024-09",
                "current": false,
                "tech": "SQL · Excel · 情景测算",
                "bullets": [
                  "将活动新增、原有会员复购及提前购买拆开观察，排除退货订单，并与财务统一优惠券费用的归属周期。",
                  "按会员活跃度对比购买变化，发现低活跃组响应集中在高折扣商品，建议缩小普发券范围并设置毛利底线。",
                  "在 6 家可比门店进行四周试行，跟踪每单毛利与活跃会员数；报告注明门店差异与观察周期，支持下一季预算讨论。"
                ]
              }
            ],
            "_config": {
              "moduleName": "分析项目"
            }
          },
          "sortOrder": 3,
          "layout": "left"
        },
        {
          "sectionType": "education",
          "data": {
            "items": [
              {
                "school": "海川财经学院（虚构）",
                "major": "经济统计学",
                "degree": "本科",
                "startDate": "2018-09",
                "endDate": "2022-06",
                "current": false,
                "description": "相关课程：计量经济学、管理会计、市场研究和运筹学。课程设计使用公开零售数据比较区域需求，练习模型假设、敏感性分析与结论表达。"
              }
            ],
            "_config": {
              "moduleName": "教育背景"
            }
          },
          "sortOrder": 4,
          "layout": "right"
        },
        {
          "sectionType": "skills",
          "data": {
            "items": [
              {
                "name": "业务拆解",
                "items": [
                  "收入与毛利分析",
                  "单位经济模型",
                  "渠道比较"
                ]
              },
              {
                "name": "数据工具",
                "items": [
                  "SQL 多表与窗口函数",
                  "Excel 情景分析",
                  "Power BI"
                ]
              },
              {
                "name": "研究表达",
                "items": [
                  "访谈提纲",
                  "资料交叉核验",
                  "管理汇报"
                ]
              }
            ],
            "_config": {
              "moduleName": "分析能力"
            }
          },
          "sortOrder": 5,
          "layout": "right"
        },
        {
          "sectionType": "custom",
          "data": {
            "content": "为经营报告维护指标字典与假设页，说明数据范围、更新周期、异常处理及尚未验证的问题。每次评审将结论拆为可立即执行、需要小范围验证和需要补充资料三类建议，注明负责人及观察指标，方便业务在下次复盘中回看实际执行结果。",
            "_config": {
              "moduleName": "分析交付规范"
            }
          },
          "sortOrder": 6,
          "layout": "right"
        }
      ]
    }
  },
  {
    "key": "brand-designer",
    "name": "品牌视觉·创意作品",
    "description": "品牌视觉设计师原创范文，适用于3–5 年。品牌系统、传播物料、作品交付；含可编辑完整经历与项目，示例内容请替换为真实经历。",
    "category": "design",
    "tags": [
      "品牌视觉设计师",
      "3–5 年",
      "侧栏",
      "品牌系统",
      "传播物料"
    ],
    "sortOrder": 3,
    "legacyNames": [
      "创意设计"
    ],
    "config": {
      "systemKey": "brand-designer",
      "layout": "sidebar",
      "fonts": [
        "Noto Sans SC",
        "Microsoft YaHei",
        "system-ui"
      ],
      "primaryColor": "#7c3aed",
      "accentColor": "#7c3aed12",
      "headerStyle": "solid",
      "sections": [
        "basic",
        "summary",
        "experience",
        "projects",
        "education",
        "skills",
        "custom"
      ],
      "globalFontSize": 13,
      "globalLineSpacing": 1.55,
      "pageTopMargin": 36,
      "pageBottomMargin": 36,
      "pageLeftMargin": 38,
      "pageRightMargin": 38,
      "moduleMargin": 14,
      "titleTopPadding": 4,
      "titleBottomMargin": 7
    },
    "sample": {
      "version": 1,
      "profile": {
        "key": "brand-designer",
        "jobTitle": "品牌视觉设计师",
        "experienceLevel": "3–5 年",
        "highlights": [
          "品牌系统",
          "传播物料",
          "作品交付"
        ],
        "suggestedPages": 1
      },
      "sections": [
        {
          "sectionType": "basic",
          "data": {
            "name": "周予棠",
            "jobTitle": "品牌视觉设计师",
            "city": "上海",
            "phone": "138****1003",
            "email": "yutang.zhou@example.com",
            "links": [],
            "_config": {
              "moduleName": "基本信息"
            }
          },
          "sortOrder": 0,
          "layout": "auto"
        },
        {
          "sectionType": "summary",
          "data": {
            "content": "2022 年起从事消费品牌视觉设计，围绕品牌定位完成标识应用、包装与传播物料。能将文字策略转为视觉方向，通过打样和场景展示检验方案，熟悉从设计评审到印刷交付的协作流程。作品集中说明设计问题、个人职责及最终落地情况。",
            "_config": {
              "moduleName": "设计概述"
            }
          },
          "sortOrder": 1,
          "layout": "right"
        },
        {
          "sectionType": "experience",
          "data": {
            "items": [
              {
                "company": "山禾品牌工作室（虚构）",
                "position": "品牌视觉设计师",
                "startDate": "2023-08",
                "endDate": "",
                "current": true,
                "bullets": [
                  "参与 5 个消费品牌的视觉更新，依据品牌访谈和竞品研究提出设计方向，分别展示包装、门店与线上传播的应用效果。",
                  "负责字体、色彩、图形和版式规范，补齐小尺寸、单色及深色背景示例，帮助客户执行团队保持应用一致。",
                  "对接印刷供应商完成纸张、专色与工艺打样，登记修改意见和色差确认记录，交付可编辑文件及印前检查表。"
                ]
              },
              {
                "company": "观原创意机构（虚构）",
                "position": "视觉设计助理",
                "startDate": "2022-07",
                "endDate": "2023-07",
                "current": false,
                "bullets": [
                  "配合设计负责人制作展会主视觉、社交媒体和产品折页，按尺寸清单适配 30 余份物料并核对文案层级。",
                  "整理摄影与插画素材授权范围，将源文件、字体及链接图片按项目归档，减少交接时寻找素材的时间。",
                  "在活动上线前检查二维码、出血与低清图片问题，与运营逐项确认，记录常见返修原因供后续项目参考。"
                ]
              }
            ],
            "_config": {
              "moduleName": "工作经历"
            }
          },
          "sortOrder": 2,
          "layout": "right"
        },
        {
          "sectionType": "projects",
          "data": {
            "items": [
              {
                "name": "禾野茶饮品牌视觉更新",
                "role": "视觉系统与包装设计",
                "startDate": "2024-03",
                "endDate": "2024-08",
                "current": false,
                "tech": "品牌策略转译 · 包装打样",
                "bullets": [
                  "从“日常通勤也能轻松喝茶”的定位出发，比较三组图形与字体方向，结合杯身和门头模拟稿解释选择依据。",
                  "设计标识组合、三款杯套和外带纸袋，建立 16 页应用指南，说明留白、最小尺寸、颜色和禁用情形。",
                  "完成两轮实际打样与门店查看，调整杯身小字与深色印刷效果，最终交付源文件、印刷文件及使用说明。"
                ]
              }
            ],
            "_config": {
              "moduleName": "品牌作品"
            }
          },
          "sortOrder": 3,
          "layout": "right"
        },
        {
          "sectionType": "education",
          "data": {
            "items": [
              {
                "school": "江南艺术学院（虚构）",
                "major": "视觉传达设计",
                "degree": "本科",
                "startDate": "2018-09",
                "endDate": "2022-06",
                "current": false,
                "description": "学习品牌设计、字体设计、包装结构与印刷工艺。毕业设计为地方文化展陈视觉系统，完成访谈、图形提炼、海报及导览物料。"
              }
            ],
            "_config": {
              "moduleName": "教育背景"
            }
          },
          "sortOrder": 4,
          "layout": "right"
        },
        {
          "sectionType": "skills",
          "data": {
            "items": [
              {
                "name": "品牌视觉",
                "items": [
                  "标识与应用",
                  "字体与版式",
                  "包装系统"
                ]
              },
              {
                "name": "设计工具",
                "items": [
                  "Illustrator",
                  "Photoshop",
                  "InDesign"
                ]
              },
              {
                "name": "生产交付",
                "items": [
                  "印前检查",
                  "工艺打样",
                  "源文件规范"
                ]
              }
            ],
            "_config": {
              "moduleName": "设计技能"
            }
          },
          "sortOrder": 5,
          "layout": "left"
        },
        {
          "sectionType": "custom",
          "data": {
            "content": "作品集示例地址：portfolio.example.com/yutang。按品牌视觉、包装应用与活动传播三个章节展示项目，每个项目附需求、草图、设计取舍与落地照片说明。团队作品注明本人负责的部分；示例图与品牌均为虚构，实际求职时替换为拥有展示权限的作品。",
            "_config": {
              "moduleName": "作品集导读"
            }
          },
          "sortOrder": 6,
          "layout": "right"
        }
      ]
    }
  },
  {
    "key": "java-backend",
    "name": "Java 后端·工程实践",
    "description": "Java 后端开发工程师原创范文，适用于3–5 年。订单履约、幂等补偿、性能观测；含可编辑完整经历与项目，示例内容请替换为真实经历。",
    "category": "technical",
    "tags": [
      "Java 后端开发工程师",
      "3–5 年",
      "双栏",
      "订单履约",
      "幂等补偿"
    ],
    "sortOrder": 4,
    "legacyNames": [
      "技术研发"
    ],
    "config": {
      "systemKey": "java-backend",
      "layout": "two-column",
      "fonts": [
        "Noto Sans SC",
        "Microsoft YaHei",
        "system-ui"
      ],
      "primaryColor": "#0f766e",
      "accentColor": "#0f766e12",
      "headerStyle": "bar",
      "sections": [
        "basic",
        "summary",
        "experience",
        "projects",
        "education",
        "skills"
      ],
      "globalFontSize": 13,
      "globalLineSpacing": 1.55,
      "pageTopMargin": 36,
      "pageBottomMargin": 36,
      "pageLeftMargin": 38,
      "pageRightMargin": 38,
      "moduleMargin": 14,
      "titleTopPadding": 4,
      "titleBottomMargin": 7
    },
    "sample": {
      "version": 1,
      "profile": {
        "key": "java-backend",
        "jobTitle": "Java 后端开发工程师",
        "experienceLevel": "3–5 年",
        "highlights": [
          "订单履约",
          "幂等补偿",
          "性能观测"
        ],
        "suggestedPages": 1
      },
      "sections": [
        {
          "sectionType": "basic",
          "data": {
            "name": "林知远",
            "jobTitle": "Java 后端开发工程师",
            "city": "杭州",
            "phone": "138****1004",
            "email": "zhiyuan.lin@example.com",
            "links": [],
            "_config": {
              "moduleName": "基本信息"
            }
          },
          "sortOrder": 0,
          "layout": "auto"
        },
        {
          "sectionType": "summary",
          "data": {
            "content": "2021 年 11 月开始从事 Java 后端开发，参与订单履约与企业任务平台建设。能够独立完成需求澄清、接口设计、数据建模和上线观测，关注高峰流量下的数据一致性、接口响应与故障恢复，习惯通过验收用例和运行记录说明方案效果。",
            "_config": {
              "moduleName": "职业概述"
            }
          },
          "sortOrder": 1,
          "layout": "left"
        },
        {
          "sectionType": "experience",
          "data": {
            "items": [
              {
                "company": "远舟数字科技（虚构）",
                "position": "Java 后端工程师",
                "startDate": "2023-03",
                "endDate": "",
                "current": true,
                "bullets": [
                  "负责库存预占、订单状态和对账接口，与产品、仓储及财务梳理 18 种异常场景，明确补偿规则与验收用例。",
                  "针对查询抖动调整复合索引与热点缓存，在同等压测负载下，订单详情接口 P95 从 620ms 降至 180ms。",
                  "为回调与消息消费加入业务幂等键、事务消息表和失败重试，建立每日核对任务，将人工排查从约 2 小时缩至 30 分钟。"
                ]
              },
              {
                "company": "星桥软件服务（虚构）",
                "position": "Java 开发工程师",
                "startDate": "2021-11",
                "endDate": "2023-02",
                "current": false,
                "bullets": [
                  "参与客户、权限与报表模块建设，交付 24 个接口，补充参数边界与错误码文档，支持 3 个客户项目上线。",
                  "将批量导出改为异步任务和分页读取，在 10 万行验收集上验证超时、取消和文件过期处理，减少同步请求占用。",
                  "参与代码评审和轮值问题处理，整理 12 条排障步骤，记录日志位置、复现方法与恢复条件，便于新成员接手维护。"
                ]
              }
            ],
            "_config": {
              "moduleName": "工作经历"
            }
          },
          "sortOrder": 2,
          "layout": "right"
        },
        {
          "sectionType": "projects",
          "data": {
            "items": [
              {
                "name": "订单异常自动核对",
                "role": "核心开发",
                "startDate": "2024-02",
                "endDate": "2024-06",
                "current": false,
                "tech": "Spring Boot · PostgreSQL · RabbitMQ",
                "bullets": [
                  "将支付、订单和仓储状态映射为统一规则，按时间窗口分批扫描，保存核对游标，避免全表查询影响在线请求。",
                  "为缺失回调、重复通知和超时关闭设计可重入补偿，支持预演与人工复核，在重试前检查业务状态，避免重复处理库存。",
                  "以脱敏历史异常构建验收集，覆盖 42 个边界场景；上线后输出核对日报，跟踪未解决事项并保留人工处理记录。"
                ]
              },
              {
                "name": "企业任务调度台",
                "role": "后端开发",
                "startDate": "2022-06",
                "endDate": "2022-11",
                "current": false,
                "tech": "Java · Redis · Docker",
                "bullets": [
                  "建立任务定义、执行记录与失败原因的数据结构，支持定时触发、执行超时和取消，向使用方说明各状态的含义。",
                  "为任务分片引入租约和执行令牌，验证工作节点重启与租约过期后的接管过程，避免相同任务被重复执行。",
                  "提供按任务、时间和状态检索的日志接口，将常见失败原因整理成处理提示，并补充部署与回滚说明供值班人员使用。"
                ]
              }
            ],
            "_config": {
              "moduleName": "项目经历"
            }
          },
          "sortOrder": 3,
          "layout": "left"
        },
        {
          "sectionType": "education",
          "data": {
            "items": [
              {
                "school": "江城理工学院（虚构）",
                "major": "计算机科学与技术",
                "degree": "本科",
                "startDate": "2017-09",
                "endDate": "2021-06",
                "current": false,
                "description": "课程实践：数据库原理、计算机网络、操作系统与软件工程。毕业设计为校园预约服务，负责接口、数据表和部署说明，并完成预约冲突边界验证。"
              }
            ],
            "_config": {
              "moduleName": "教育背景"
            }
          },
          "sortOrder": 4,
          "layout": "right"
        },
        {
          "sectionType": "skills",
          "data": {
            "items": [
              {
                "name": "后端开发",
                "items": [
                  "Java",
                  "Spring Boot/Cloud",
                  "接口设计与鉴权"
                ]
              },
              {
                "name": "数据可靠性",
                "items": [
                  "PostgreSQL/MySQL",
                  "Redis 缓存",
                  "RabbitMQ 与幂等补偿"
                ]
              },
              {
                "name": "工程交付",
                "items": [
                  "JUnit",
                  "Docker/Linux",
                  "日志与指标定位"
                ]
              }
            ],
            "_config": {
              "moduleName": "专业技能"
            }
          },
          "sortOrder": 5,
          "layout": "right"
        }
      ]
    }
  },
  {
    "key": "academic-research",
    "name": "学术科研·研究成果",
    "description": "环境科学科研助理原创范文，适用于硕士/科研申请。研究问题、实验设计、成果边界；含可编辑完整经历与项目，示例内容请替换为真实经历。",
    "category": "academic",
    "tags": [
      "环境科学科研助理",
      "硕士/科研申请",
      "单栏",
      "研究问题",
      "实验设计"
    ],
    "sortOrder": 5,
    "legacyNames": [
      "学术科研"
    ],
    "config": {
      "systemKey": "academic-research",
      "layout": "single-column",
      "fonts": [
        "Noto Sans SC",
        "Microsoft YaHei",
        "system-ui"
      ],
      "primaryColor": "#334155",
      "accentColor": "#33415512",
      "headerStyle": "underline",
      "sections": [
        "basic",
        "education",
        "summary",
        "experience",
        "projects",
        "custom",
        "skills",
        "awards"
      ],
      "globalFontSize": 13,
      "globalLineSpacing": 1.55,
      "pageTopMargin": 36,
      "pageBottomMargin": 36,
      "pageLeftMargin": 38,
      "pageRightMargin": 38,
      "moduleMargin": 14,
      "titleTopPadding": 4,
      "titleBottomMargin": 7
    },
    "sample": {
      "version": 1,
      "profile": {
        "key": "academic-research",
        "jobTitle": "环境科学科研助理",
        "experienceLevel": "硕士/科研申请",
        "highlights": [
          "研究问题",
          "实验设计",
          "成果边界"
        ],
        "suggestedPages": 2
      },
      "sections": [
        {
          "sectionType": "basic",
          "data": {
            "name": "陈知夏",
            "jobTitle": "环境科学科研助理",
            "city": "南京",
            "phone": "138****1005",
            "email": "zhixia.chen@example.com",
            "links": [],
            "_config": {
              "moduleName": "基本信息"
            }
          },
          "sortOrder": 0,
          "layout": "auto"
        },
        {
          "sectionType": "education",
          "data": {
            "items": [
              {
                "school": "江南环境研究学院（虚构）",
                "major": "环境科学",
                "degree": "硕士",
                "startDate": "2022-09",
                "endDate": "2025-06",
                "current": false,
                "description": "研究方向为城市河道沉积物污染特征与采样不确定性。完成实验设计、环境统计、分析化学课程；学位论文围绕重复采样与空白对照对检测结论的影响。"
              },
              {
                "school": "清源理工学院（虚构）",
                "major": "环境工程",
                "degree": "本科",
                "startDate": "2018-09",
                "endDate": "2022-06",
                "current": false,
                "description": "相关课程：环境监测、水污染控制、仪器分析与概率统计。毕业设计完成小型实验装置的采样方案和运行记录，接受实验安全与数据完整性训练。"
              }
            ],
            "_config": {
              "moduleName": "教育背景"
            }
          },
          "sortOrder": 1,
          "layout": "auto"
        },
        {
          "sectionType": "summary",
          "data": {
            "content": "关注环境监测中的采样差异与质量控制，具备文献梳理、现场采样、实验记录和统计分析训练。硕士期间参与河道沉积物调查，独立完成样品追踪与部分数据分析；目前在研究团队协助开展方法验证，申请继续从事环境数据与监测方法研究。",
            "_config": {
              "moduleName": "研究概述"
            }
          },
          "sortOrder": 2,
          "layout": "auto"
        },
        {
          "sectionType": "experience",
          "data": {
            "items": [
              {
                "company": "澄湖环境研究中心（虚构）",
                "position": "科研助理",
                "startDate": "2025-07",
                "endDate": "",
                "current": true,
                "bullets": [
                  "协助开展沉积物检测方法验证，维护样品编号、前处理批次和仪器序列，确保检测结果能够关联到原始记录。",
                  "按研究方案设置平行样、空白与加标样，整理回收率和重复性结果，发现异常后先检查批次与仪器状态再讨论重测。",
                  "每两周向课题组汇报方法变化与未解决问题，保留分析脚本版本、参数及数据字典，支持同组成员复核过程。"
                ]
              }
            ],
            "_config": {
              "moduleName": "研究经历"
            }
          },
          "sortOrder": 3,
          "layout": "auto"
        },
        {
          "sectionType": "projects",
          "data": {
            "items": [
              {
                "name": "城市河道沉积物分层采样研究",
                "role": "采样记录与统计分析",
                "startDate": "2023-03",
                "endDate": "2024-12",
                "current": false,
                "tech": "现场调查 · R · 质量控制",
                "bullets": [
                  "围绕站点间差异是否大于重复采样差异提出研究问题，参与设计 8 个站点、两轮采样与平行样安排。",
                  "负责 96 份样品的流转记录和数据清洗，以图形和混合效应模型比较站点及批次影响，记录缺失值的处理理由。",
                  "在组会上报告结果及采样限制，说明观察关联不能推断污染来源；形成方法附录，为后续增补季节样本提供依据。"
                ]
              },
              {
                "name": "环境监测结果可复核报告",
                "role": "分析脚本与图表",
                "startDate": "2024-02",
                "endDate": "2024-06",
                "current": false,
                "tech": "R Markdown · 文献比较",
                "bullets": [
                  "将样品信息、检测值与质控记录统一到长表结构，对重复编号、单位换算和检出限标记设置核对规则。",
                  "把描述统计、敏感性分析与图表生成写入可重复运行的报告，分别展示不同缺失值处理假设下的结论变化。",
                  "邀请两名同组成员使用独立样例运行报告，修正路径依赖与参数说明，保存版本及复核意见用于论文补充材料。"
                ]
              }
            ],
            "_config": {
              "moduleName": "研究项目"
            }
          },
          "sortOrder": 4,
          "layout": "auto"
        },
        {
          "sectionType": "custom",
          "data": {
            "content": "硕士学位论文《城市河道沉积物监测中重复采样差异的评价》（虚构题目，2025.06），本人完成数据分析与正文初稿。课题组内部报告《沉积物样品质量控制记录与方法比较》（示例，2024.12），负责质量控制章节与图表。本示例不虚构期刊录用状态；实际申请时注明真实作者顺序、发表或投稿状态及可核验来源。",
            "_config": {
              "moduleName": "论文与研究报告"
            }
          },
          "sortOrder": 5,
          "layout": "auto"
        },
        {
          "sectionType": "skills",
          "data": {
            "items": [
              {
                "name": "研究方法",
                "items": [
                  "文献检索与证据表",
                  "实验与采样方案",
                  "质量控制"
                ]
              },
              {
                "name": "分析工具",
                "items": [
                  "R/tidyverse",
                  "混合效应模型基础",
                  "可复核报告"
                ]
              },
              {
                "name": "学术交流",
                "items": [
                  "研究记录",
                  "学术图表",
                  "英文文献阅读"
                ]
              }
            ],
            "_config": {
              "moduleName": "科研技能"
            }
          },
          "sortOrder": 6,
          "layout": "auto"
        },
        {
          "sectionType": "awards",
          "data": {
            "items": [
              {
                "title": "研究生学业奖学金（示例）",
                "date": "2024-11",
                "level": "校级"
              },
              {
                "title": "研究生学术交流海报展示（示例）",
                "date": "2024-05",
                "level": "院级交流"
              }
            ],
            "_config": {
              "moduleName": "奖项与交流"
            }
          },
          "sortOrder": 7,
          "layout": "auto"
        }
      ]
    }
  },
  {
    "key": "project-manager",
    "name": "项目管理·交付协同",
    "description": "实施项目经理原创范文，适用于5 年以上。里程碑管理、范围与风险、客户验收；含可编辑完整经历与项目，示例内容请替换为真实经历。",
    "category": "business",
    "tags": [
      "实施项目经理",
      "5 年以上",
      "单栏",
      "里程碑管理",
      "范围与风险"
    ],
    "sortOrder": 6,
    "legacyNames": [
      "商务管理"
    ],
    "config": {
      "systemKey": "project-manager",
      "layout": "single-column",
      "fonts": [
        "Noto Sans SC",
        "Microsoft YaHei",
        "system-ui"
      ],
      "primaryColor": "#0f172a",
      "accentColor": "#0f172a12",
      "headerStyle": "underline",
      "sections": [
        "basic",
        "summary",
        "experience",
        "projects",
        "education",
        "skills",
        "certificates"
      ],
      "globalFontSize": 13,
      "globalLineSpacing": 1.55,
      "pageTopMargin": 36,
      "pageBottomMargin": 36,
      "pageLeftMargin": 38,
      "pageRightMargin": 38,
      "moduleMargin": 14,
      "titleTopPadding": 4,
      "titleBottomMargin": 7
    },
    "sample": {
      "version": 1,
      "profile": {
        "key": "project-manager",
        "jobTitle": "实施项目经理",
        "experienceLevel": "5 年以上",
        "highlights": [
          "里程碑管理",
          "范围与风险",
          "客户验收"
        ],
        "suggestedPages": 1
      },
      "sections": [
        {
          "sectionType": "basic",
          "data": {
            "name": "顾明川",
            "jobTitle": "实施项目经理",
            "city": "苏州",
            "phone": "138****1006",
            "email": "mingchuan.gu@example.com",
            "links": [],
            "_config": {
              "moduleName": "基本信息"
            }
          },
          "sortOrder": 0,
          "layout": "auto"
        },
        {
          "sectionType": "summary",
          "data": {
            "content": "2018 年起参与制造企业信息化项目，经历实施顾问与项目经理岗位，熟悉从需求澄清、试点到验收移交的交付过程。能够协调客户业务、研发和实施资源，识别范围变化与依赖风险，采用可检查的里程碑和问题清单推动决策与落地。",
            "_config": {
              "moduleName": "职业概述"
            }
          },
          "sortOrder": 1,
          "layout": "auto"
        },
        {
          "sectionType": "experience",
          "data": {
            "items": [
              {
                "company": "知行工业软件（虚构）",
                "position": "实施项目经理",
                "startDate": "2022-03",
                "endDate": "",
                "current": true,
                "bullets": [
                  "负责 4 个制造客户的协同排产项目，依据合同范围拆解交付物和验收条件，组织业务、技术与客户负责人共同确认基线。",
                  "协调 8 人项目小组，按周跟踪接口、主数据与现场准备的依赖；对资源冲突形成方案和影响说明，提交项目委员会决策。",
                  "建立试运行问题分级、责任人与关闭证据，完成 3 个项目阶段验收；将遗留事项约定到服务交接表并持续跟进。"
                ]
              },
              {
                "company": "启程管理科技（虚构）",
                "position": "实施顾问",
                "startDate": "2018-07",
                "endDate": "2022-02",
                "current": false,
                "bullets": [
                  "参与 6 个采购与库存系统实施，走访仓库和财务岗位梳理单据流，形成配置、接口与权限需求，供负责人核对范围。",
                  "组织用户操作培训和关键用户演练，按岗位整理操作手册，以真实业务样例检验盘点、退货和跨月处理流程。",
                  "驻场期间记录每日异常与临时处理方式，跟进研发修复和用户复核，将重复问题归纳为上线准备清单。"
                ]
              }
            ],
            "_config": {
              "moduleName": "工作经历"
            }
          },
          "sortOrder": 2,
          "layout": "auto"
        },
        {
          "sectionType": "projects",
          "data": {
            "items": [
              {
                "name": "三工厂排产协同系统上线",
                "role": "项目经理",
                "startDate": "2024-02",
                "endDate": "2025-01",
                "current": false,
                "tech": "阶段交付 · 依赖管理 · 验收",
                "bullets": [
                  "将三家工厂的排产差异拆分为公共流程和本地规则，先在一家工厂试点，冻结首期边界并设定每阶段的进入条件。",
                  "识别设备接口交付延迟风险，调整联调顺序并启用模拟数据验证非接口流程，使业务培训和主数据检查按原计划推进。",
                  "组织两轮整体验证与四周试运行，按 68 项验收条目提交证据；上线后移交值班安排、回退条件与未完成事项责任人。"
                ]
              }
            ],
            "_config": {
              "moduleName": "重点项目"
            }
          },
          "sortOrder": 3,
          "layout": "auto"
        },
        {
          "sectionType": "education",
          "data": {
            "items": [
              {
                "school": "东江工程学院（虚构）",
                "major": "信息管理与信息系统",
                "degree": "本科",
                "startDate": "2014-09",
                "endDate": "2018-06",
                "current": false,
                "description": "课程包括项目管理、管理信息系统、数据库和供应链管理。毕业实践参与校内资产管理系统需求调研，形成流程图与验收案例。"
              }
            ],
            "_config": {
              "moduleName": "教育背景"
            }
          },
          "sortOrder": 4,
          "layout": "auto"
        },
        {
          "sectionType": "skills",
          "data": {
            "items": [
              {
                "name": "计划管理",
                "items": [
                  "工作分解结构",
                  "里程碑与依赖",
                  "资源排期"
                ]
              },
              {
                "name": "范围风险",
                "items": [
                  "变更影响分析",
                  "风险台账",
                  "决策纪要"
                ]
              },
              {
                "name": "客户协作",
                "items": [
                  "关键用户培训",
                  "验收证据",
                  "服务移交"
                ]
              }
            ],
            "_config": {
              "moduleName": "交付能力"
            }
          },
          "sortOrder": 5,
          "layout": "auto"
        },
        {
          "sectionType": "certificates",
          "data": {
            "items": [
              {
                "title": "项目管理专业培训结业（示例）",
                "date": "2022-11",
                "level": "项目计划与风险专题"
              },
              {
                "title": "信息系统项目管理师资格（示例）",
                "date": "2023-11",
                "level": "按真实取得情况替换"
              }
            ],
            "_config": {
              "moduleName": "专业学习"
            }
          },
          "sortOrder": 6,
          "layout": "auto"
        }
      ]
    }
  },
  {
    "key": "product-manager",
    "name": "产品经理·业务成果",
    "description": "B 端产品经理原创范文，适用于3–5 年。用户问题、需求判断、上线验证；含可编辑完整经历与项目，示例内容请替换为真实经历。",
    "category": "product",
    "tags": [
      "B 端产品经理",
      "3–5 年",
      "单栏",
      "用户问题",
      "需求判断"
    ],
    "sortOrder": 7,
    "legacyNames": [
      "产品运营"
    ],
    "config": {
      "systemKey": "product-manager",
      "layout": "single-column",
      "fonts": [
        "Noto Sans SC",
        "Microsoft YaHei",
        "system-ui"
      ],
      "primaryColor": "#2563eb",
      "accentColor": "#2563eb12",
      "headerStyle": "underline",
      "sections": [
        "basic",
        "summary",
        "experience",
        "projects",
        "education",
        "skills",
        "custom"
      ],
      "globalFontSize": 13,
      "globalLineSpacing": 1.55,
      "pageTopMargin": 36,
      "pageBottomMargin": 36,
      "pageLeftMargin": 38,
      "pageRightMargin": 38,
      "moduleMargin": 14,
      "titleTopPadding": 4,
      "titleBottomMargin": 7
    },
    "sample": {
      "version": 1,
      "profile": {
        "key": "product-manager",
        "jobTitle": "B 端产品经理",
        "experienceLevel": "3–5 年",
        "highlights": [
          "用户问题",
          "需求判断",
          "上线验证"
        ],
        "suggestedPages": 1
      },
      "sections": [
        {
          "sectionType": "basic",
          "data": {
            "name": "王予诺",
            "jobTitle": "B 端产品经理",
            "city": "北京",
            "phone": "138****1007",
            "email": "yunnuo.wang@example.com",
            "links": [],
            "_config": {
              "moduleName": "基本信息"
            }
          },
          "sortOrder": 0,
          "layout": "auto"
        },
        {
          "sectionType": "summary",
          "data": {
            "content": "2022 年起从事企业服务产品工作，负责审批协作与客户自助服务方向。习惯结合访谈、服务记录和行为数据确定问题，明确需求边界、异常状态与验收条件；与设计、研发和运营共同推进上线，并用使用反馈检验方案是否解决原始问题。",
            "_config": {
              "moduleName": "职业概述"
            }
          },
          "sortOrder": 1,
          "layout": "auto"
        },
        {
          "sectionType": "experience",
          "data": {
            "items": [
              {
                "company": "远树协作科技（虚构）",
                "position": "产品经理",
                "startDate": "2023-10",
                "endDate": "",
                "current": true,
                "bullets": [
                  "负责企业审批与任务协作模块，访谈 12 名管理员与业务用户，将反馈按使用频率、阻塞程度和实现成本整理成需求池。",
                  "围绕跨部门审批追踪难题，补齐状态、催办与代理规则，推动设计和研发评审异常流程，按两期交付避免扩大首期范围。",
                  "建立上线后四周观察清单，对照工单与关键任务路径复盘；为未达预期的功能继续回访，明确保留、优化或撤回的依据。"
                ]
              },
              {
                "company": "初原企业软件（虚构）",
                "position": "产品助理",
                "startDate": "2022-07",
                "endDate": "2023-09",
                "current": false,
                "bullets": [
                  "整理客户自助服务的高频问题，编写需求说明和交互原型，配合负责人完成订阅查询、发票申请和联系人维护功能。",
                  "维护埋点字典与验收用例，在联调时核查权限、空状态及失败提示，避免仅按正常操作路径验收功能。",
                  "每月汇总使用数据和客服意见，为需求评审准备问题证据、影响范围及已有替代方案，支持负责人安排迭代。"
                ]
              }
            ],
            "_config": {
              "moduleName": "工作经历"
            }
          },
          "sortOrder": 2,
          "layout": "auto"
        },
        {
          "sectionType": "projects",
          "data": {
            "items": [
              {
                "name": "审批进度透明化",
                "role": "产品设计与上线复盘",
                "startDate": "2024-04",
                "endDate": "2024-10",
                "current": false,
                "tech": "访谈 · 状态建模 · 行为分析",
                "bullets": [
                  "从 146 条审批咨询中归纳看不到处理人、无法判断等待原因两类问题，绘制提交者与审批者的完整任务路径。",
                  "定义节点状态、预计处理提示与提醒频率，针对转交、撤回及重复提交补齐规则，并用原型完成 8 位用户的任务走查。",
                  "在 20 家试点企业上线后跟踪四周，同口径进度咨询从每百笔 11 次降至 6 次；报告同时说明试点规模和使用差异。"
                ]
              }
            ],
            "_config": {
              "moduleName": "产品项目"
            }
          },
          "sortOrder": 3,
          "layout": "auto"
        },
        {
          "sectionType": "education",
          "data": {
            "items": [
              {
                "school": "北川信息学院（虚构）",
                "major": "信息管理与信息系统",
                "degree": "本科",
                "startDate": "2018-09",
                "endDate": "2022-06",
                "current": false,
                "description": "学习管理学、数据库、统计与人机交互。课程项目完成校园设备借用流程调研，交付需求文档、原型和验证记录。"
              }
            ],
            "_config": {
              "moduleName": "教育背景"
            }
          },
          "sortOrder": 4,
          "layout": "auto"
        },
        {
          "sectionType": "skills",
          "data": {
            "items": [
              {
                "name": "发现问题",
                "items": [
                  "访谈与工单归类",
                  "任务流程",
                  "需求优先级"
                ]
              },
              {
                "name": "方案交付",
                "items": [
                  "原型与状态规则",
                  "验收用例",
                  "跨团队评审"
                ]
              },
              {
                "name": "效果验证",
                "items": [
                  "SQL 基础查询",
                  "漏斗与分群",
                  "上线复盘"
                ]
              }
            ],
            "_config": {
              "moduleName": "产品技能"
            }
          },
          "sortOrder": 5,
          "layout": "auto"
        },
        {
          "sectionType": "custom",
          "data": {
            "content": "需求说明固定包含问题证据、目标用户、流程、权限、异常状态及观察指标；变更时注明影响页面和接口。推动设计、研发及客服在开发前各走查一次实际任务，使用统一问题清单收口。复盘区分功能被使用与问题被解决，保留未解决反馈供后续迭代判断。",
            "_config": {
              "moduleName": "文档与协作"
            }
          },
          "sortOrder": 6,
          "layout": "auto"
        }
      ]
    }
  },
  {
    "key": "ux-designer",
    "name": "UI/UX·体验设计",
    "description": "UI/UX 设计师原创范文，适用于3–5 年。任务流程、组件规范、可用性验证；含可编辑完整经历与项目，示例内容请替换为真实经历。",
    "category": "design",
    "tags": [
      "UI/UX 设计师",
      "3–5 年",
      "单栏",
      "任务流程",
      "组件规范"
    ],
    "sortOrder": 8,
    "legacyNames": [
      "界面设计"
    ],
    "config": {
      "systemKey": "ux-designer",
      "layout": "single-column",
      "fonts": [
        "Noto Sans SC",
        "Microsoft YaHei",
        "system-ui"
      ],
      "primaryColor": "#be185d",
      "accentColor": "#be185d12",
      "headerStyle": "underline",
      "sections": [
        "basic",
        "summary",
        "experience",
        "projects",
        "education",
        "skills",
        "custom"
      ],
      "globalFontSize": 13,
      "globalLineSpacing": 1.55,
      "pageTopMargin": 36,
      "pageBottomMargin": 36,
      "pageLeftMargin": 38,
      "pageRightMargin": 38,
      "moduleMargin": 14,
      "titleTopPadding": 4,
      "titleBottomMargin": 7
    },
    "sample": {
      "version": 1,
      "profile": {
        "key": "ux-designer",
        "jobTitle": "UI/UX 设计师",
        "experienceLevel": "3–5 年",
        "highlights": [
          "任务流程",
          "组件规范",
          "可用性验证"
        ],
        "suggestedPages": 1
      },
      "sections": [
        {
          "sectionType": "basic",
          "data": {
            "name": "许映禾",
            "jobTitle": "UI/UX 设计师",
            "city": "深圳",
            "phone": "138****1008",
            "email": "yinghe.xu@example.com",
            "links": [],
            "_config": {
              "moduleName": "基本信息"
            }
          },
          "sortOrder": 0,
          "layout": "auto"
        },
        {
          "sectionType": "summary",
          "data": {
            "content": "2022 年起从事企业工具与移动端体验设计，能够从用户任务出发开展访谈、流程梳理、原型和界面交付。关注信息层级、异常反馈与组件一致性，通过任务测试和上线观察修正方案；作品中保留过程依据，清楚说明个人职责与协作范围。",
            "_config": {
              "moduleName": "设计概述"
            }
          },
          "sortOrder": 1,
          "layout": "auto"
        },
        {
          "sectionType": "experience",
          "data": {
            "items": [
              {
                "company": "星野协作产品（虚构）",
                "position": "体验设计师",
                "startDate": "2023-09",
                "endDate": "",
                "current": true,
                "bullets": [
                  "负责工单处理和客户管理方向的交互与界面，与产品共同梳理任务、角色和权限，将复杂操作拆为清晰步骤。",
                  "维护表单、列表与状态反馈组件的设计规范，补齐加载、禁用、错误与键盘焦点样式，支持前端按统一规则实现。",
                  "每轮上线前对照设计稿走查交互细节，记录问题等级和修复状态；上线后邀请客服复盘真实工单，寻找流程阻塞点。"
                ]
              },
              {
                "company": "浅川数字设计（虚构）",
                "position": "界面设计师",
                "startDate": "2022-07",
                "endDate": "2023-08",
                "current": false,
                "bullets": [
                  "参与预约服务移动端设计，交付 26 个页面与关键流程原型，对预约冲突、改期和取消给出明确提示及后续操作。",
                  "依据现有组件整理字体、间距和颜色变量，提供尺寸与响应式说明，与前端核对不同屏幕下的信息顺序。",
                  "协助主持 6 次远程任务测试，记录误触、犹豫和失败路径，用观察证据支持页面层级与文案调整。"
                ]
              }
            ],
            "_config": {
              "moduleName": "设计经历"
            }
          },
          "sortOrder": 2,
          "layout": "auto"
        },
        {
          "sectionType": "projects",
          "data": {
            "items": [
              {
                "name": "客服工单工作台重构",
                "role": "研究与交互设计",
                "startDate": "2024-02",
                "endDate": "2024-08",
                "current": false,
                "tech": "Figma · 任务测试 · 组件规范",
                "bullets": [
                  "观察 5 位客服处理连续工单，将跨页面查找客户资料的步骤画成任务图，确认高频信息与操作优先级。",
                  "设计列表筛选、上下文信息与处理面板，比较抽屉和独立详情两种方案，在窄屏与长文本场景中验证可读性。",
                  "以同一组任务进行两轮测试，8 位参与者的任务完成中位时长从 94 秒降至 68 秒，并记录样本规模及学习效应限制。"
                ]
              }
            ],
            "_config": {
              "moduleName": "体验项目"
            }
          },
          "sortOrder": 3,
          "layout": "auto"
        },
        {
          "sectionType": "education",
          "data": {
            "items": [
              {
                "school": "南湾设计学院（虚构）",
                "major": "数字媒体艺术",
                "degree": "本科",
                "startDate": "2018-09",
                "endDate": "2022-06",
                "current": false,
                "description": "相关课程：交互设计、信息可视化、用户研究与认知心理学。毕业设计完成社区预约工具，包含访谈、线框、任务测试及方案反思。"
              }
            ],
            "_config": {
              "moduleName": "教育背景"
            }
          },
          "sortOrder": 4,
          "layout": "auto"
        },
        {
          "sectionType": "skills",
          "data": {
            "items": [
              {
                "name": "研究与验证",
                "items": [
                  "访谈与任务观察",
                  "可用性测试",
                  "问题优先级"
                ]
              },
              {
                "name": "交互设计",
                "items": [
                  "信息架构",
                  "复杂表单",
                  "异常与空状态"
                ]
              },
              {
                "name": "视觉协作",
                "items": [
                  "Figma 组件变量",
                  "响应式规范",
                  "开发走查"
                ]
              }
            ],
            "_config": {
              "moduleName": "设计方法"
            }
          },
          "sortOrder": 5,
          "layout": "auto"
        },
        {
          "sectionType": "custom",
          "data": {
            "content": "作品集示例地址：portfolio.example.com/yinghe。重点展示工单工作台、预约服务与组件规范三个项目，附任务流程、关键版本对比和验证记录。设计交付清单覆盖文字溢出、错误提示、键盘顺序及窄屏适配；团队作品说明本人负责研究与交互的范围，实际投递时替换为可公开的材料。",
            "_config": {
              "moduleName": "作品集与规范"
            }
          },
          "sortOrder": 6,
          "layout": "auto"
        }
      ]
    }
  },
  {
    "key": "graduate-developer",
    "name": "研发校招·实习项目",
    "description": "Java 开发工程师（应届）原创范文，适用于应届/实习。基础课程、开发实习、课程项目；含可编辑完整经历与项目，示例内容请替换为真实经历。",
    "category": "graduate",
    "tags": [
      "Java 开发工程师（应届）",
      "应届/实习",
      "单栏",
      "基础课程",
      "开发实习"
    ],
    "sortOrder": 9,
    "legacyNames": [
      "应届校招"
    ],
    "config": {
      "systemKey": "graduate-developer",
      "layout": "single-column",
      "fonts": [
        "Noto Sans SC",
        "Microsoft YaHei",
        "system-ui"
      ],
      "primaryColor": "#0284c7",
      "accentColor": "#0284c712",
      "headerStyle": "underline",
      "sections": [
        "basic",
        "education",
        "summary",
        "experience",
        "projects",
        "skills",
        "awards"
      ],
      "globalFontSize": 13,
      "globalLineSpacing": 1.55,
      "pageTopMargin": 36,
      "pageBottomMargin": 36,
      "pageLeftMargin": 38,
      "pageRightMargin": 38,
      "moduleMargin": 14,
      "titleTopPadding": 4,
      "titleBottomMargin": 7
    },
    "sample": {
      "version": 1,
      "profile": {
        "key": "graduate-developer",
        "jobTitle": "Java 开发工程师（应届）",
        "experienceLevel": "应届/实习",
        "highlights": [
          "基础课程",
          "开发实习",
          "课程项目"
        ],
        "suggestedPages": 1
      },
      "sections": [
        {
          "sectionType": "basic",
          "data": {
            "name": "赵晓屿",
            "jobTitle": "Java 开发工程师（应届）",
            "city": "武汉",
            "phone": "138****1009",
            "email": "xiaoyu.zhao@example.com",
            "links": [],
            "_config": {
              "moduleName": "基本信息"
            }
          },
          "sortOrder": 0,
          "layout": "auto"
        },
        {
          "sectionType": "education",
          "data": {
            "items": [
              {
                "school": "江城软件学院（虚构）",
                "major": "软件工程",
                "degree": "本科",
                "startDate": "2022-09",
                "endDate": "2026-06",
                "current": false,
                "description": "相关课程：数据结构、计算机网络、数据库、操作系统与软件工程。GPA 3.5/4.0（示例）；毕业设计为校园设备借用服务，完成需求说明、接口实现和部署文档。参加学院代码阅读小组，按周讲解集合、事务与网络请求的小例子，练习用运行结果说明理解，并保留同伴提出的问题及修正记录。"
              }
            ],
            "_config": {
              "moduleName": "教育背景"
            }
          },
          "sortOrder": 1,
          "layout": "auto"
        },
        {
          "sectionType": "summary",
          "data": {
            "content": "软件工程专业 2026 届毕业生，完成一段后端开发实习、一个课程项目与一个毕业项目。能使用 Java、Spring Boot 和关系数据库完成基本业务接口，愿意从边界用例、日志和代码评审中改进实现。项目描述区分小组目标与本人贡献，希望从初级研发岗位积累工程经验。",
            "_config": {
              "moduleName": "求职概述"
            }
          },
          "sortOrder": 2,
          "layout": "auto"
        },
        {
          "sectionType": "experience",
          "data": {
            "items": [
              {
                "company": "星桥应用软件（虚构）",
                "position": "后端开发实习生",
                "startDate": "2025-07",
                "endDate": "2025-11",
                "current": false,
                "bullets": [
                  "在导师指导下维护客户资料模块，完成 8 个新增与修改接口，按已有规范补充参数校验、错误码和接口文档。",
                  "针对批量导入中的重复记录，先编写复现数据再调整校验顺序，为空值、重复编号和部分失败补充回归用例。",
                  "参与两次版本发布准备，协助核对配置、数据库变更与回退步骤，记录联调问题的复现条件和处理结果。"
                ]
              }
            ],
            "_config": {
              "moduleName": "实习经历"
            }
          },
          "sortOrder": 3,
          "layout": "auto"
        },
        {
          "sectionType": "projects",
          "data": {
            "items": [
              {
                "name": "校园设备借用服务",
                "role": "4 人小组/后端开发",
                "startDate": "2025-12",
                "endDate": "2026-05",
                "current": false,
                "tech": "Spring Boot · PostgreSQL · JUnit",
                "bullets": [
                  "负责预约与归还模块，绘制设备状态流转，和前端约定日期、权限及冲突提示，完成 11 个业务接口。",
                  "为同一设备重复预约加入数据库约束和事务处理，在课程测试集验证重叠时间、取消和重复提交等 24 个场景。",
                  "编写初始化数据、运行说明和演示脚本，邀请 12 位同学完成任务试用，按反馈修正日期提示与错误信息。"
                ]
              },
              {
                "name": "课程资料检索工具",
                "role": "个人课程项目",
                "startDate": "2024-10",
                "endDate": "2024-12",
                "current": false,
                "tech": "Java · SQL · HTML",
                "bullets": [
                  "整理课程资料的标题、标签与文件位置，建立索引表和组合查询接口，支持按课程、年份和关键词筛选。",
                  "对比模糊查询与前缀查询的执行计划，在固定的 2 万条模拟数据上记录耗时，说明数据规模与测试环境。",
                  "完成异常提示、空结果页面和使用文档，保留需求变更与调试记录，在课堂答辩中展示实现取舍。"
                ]
              }
            ],
            "_config": {
              "moduleName": "课程与毕业项目"
            }
          },
          "sortOrder": 4,
          "layout": "auto"
        },
        {
          "sectionType": "skills",
          "data": {
            "items": [
              {
                "name": "编程基础",
                "items": [
                  "Java 集合与异常",
                  "面向对象",
                  "常见数据结构"
                ]
              },
              {
                "name": "应用开发",
                "items": [
                  "Spring Boot",
                  "PostgreSQL/MySQL",
                  "REST 接口"
                ]
              },
              {
                "name": "工程习惯",
                "items": [
                  "Git 分支协作",
                  "JUnit 边界用例",
                  "Linux 基础命令"
                ]
              }
            ],
            "_config": {
              "moduleName": "技术基础"
            }
          },
          "sortOrder": 5,
          "layout": "auto"
        },
        {
          "sectionType": "awards",
          "data": {
            "items": [
              {
                "title": "校级综合奖学金（示例）",
                "date": "2024-11",
                "level": "学习与实践"
              },
              {
                "title": "软件课程设计优秀小组（示例）",
                "date": "2025-01",
                "level": "本人负责后端模块"
              }
            ],
            "_config": {
              "moduleName": "校园成果"
            }
          },
          "sortOrder": 6,
          "layout": "auto"
        }
      ]
    }
  },
  {
    "key": "data-analyst",
    "name": "数据分析·指标实验",
    "description": "数据分析师原创范文，适用于1–3 年。指标口径、异常归因、实验分析；含可编辑完整经历与项目，示例内容请替换为真实经历。",
    "category": "technical",
    "tags": [
      "数据分析师",
      "1–3 年",
      "双栏",
      "指标口径",
      "异常归因"
    ],
    "sortOrder": 10,
    "legacyNames": [
      "数据分析"
    ],
    "config": {
      "systemKey": "data-analyst",
      "layout": "two-column",
      "fonts": [
        "Noto Sans SC",
        "Microsoft YaHei",
        "system-ui"
      ],
      "primaryColor": "#0d9488",
      "accentColor": "#0d948812",
      "headerStyle": "bar",
      "sections": [
        "basic",
        "summary",
        "experience",
        "projects",
        "education",
        "skills",
        "custom"
      ],
      "globalFontSize": 13,
      "globalLineSpacing": 1.55,
      "pageTopMargin": 36,
      "pageBottomMargin": 36,
      "pageLeftMargin": 38,
      "pageRightMargin": 38,
      "moduleMargin": 14,
      "titleTopPadding": 4,
      "titleBottomMargin": 7
    },
    "sample": {
      "version": 1,
      "profile": {
        "key": "data-analyst",
        "jobTitle": "数据分析师",
        "experienceLevel": "1–3 年",
        "highlights": [
          "指标口径",
          "异常归因",
          "实验分析"
        ],
        "suggestedPages": 1
      },
      "sections": [
        {
          "sectionType": "basic",
          "data": {
            "name": "周明澈",
            "jobTitle": "数据分析师",
            "city": "深圳",
            "phone": "138****1010",
            "email": "mingche.zhou@example.com",
            "links": [],
            "_config": {
              "moduleName": "基本信息"
            }
          },
          "sortOrder": 0,
          "layout": "auto"
        },
        {
          "sectionType": "summary",
          "data": {
            "content": "2024 年起从事电商业务数据分析，围绕交易漏斗、用户分群与活动效果提供支持。能够用 SQL 完成取数和质量检查，结合运营动作解释指标变化；参与实验方案和结论整理，习惯说明观察窗口、样本范围及不能由数据直接推断的因果关系。",
            "_config": {
              "moduleName": "职业概述"
            }
          },
          "sortOrder": 1,
          "layout": "left"
        },
        {
          "sectionType": "experience",
          "data": {
            "items": [
              {
                "company": "青屿零售科技（虚构）",
                "position": "数据分析师",
                "startDate": "2024-07",
                "endDate": "",
                "current": true,
                "bullets": [
                  "维护订单、支付与售后指标字典，和产品、财务核对取消、退款及跨日归属规则，为 6 个业务看板补齐来源与更新说明。",
                  "每天检查交易量、重复订单和关键字段缺失，对异常先核验采集及链路变化，再按渠道、设备与新老用户拆解影响。",
                  "参与 9 次活动与产品实验复盘，预先记录主指标、护栏和观察窗口；对样本不足及分组不均的结果明确限制条件。"
                ]
              }
            ],
            "_config": {
              "moduleName": "工作经历"
            }
          },
          "sortOrder": 2,
          "layout": "right"
        },
        {
          "sectionType": "projects",
          "data": {
            "items": [
              {
                "name": "新用户首单漏斗排查",
                "role": "数据整理与归因",
                "startDate": "2025-02",
                "endDate": "2025-05",
                "current": false,
                "tech": "SQL · Python · 漏斗分析",
                "bullets": [
                  "围绕注册到首单的下降趋势，统一用户去重和七日转化窗口，排除埋点晚到、测试账号和渠道结构变化的影响。",
                  "按设备、渠道和支付方式对比流失，结合客服工单发现部分浏览器的地址校验失败，提供脱敏路径样例供研发复现。",
                  "修复后使用相同口径观察两周，目标浏览器地址提交成功率从 86% 回到 94%；未将同期整体销量变化归为单一改动。"
                ]
              },
              {
                "name": "优惠券门槛实验评估",
                "role": "实验分析",
                "startDate": "2025-08",
                "endDate": "2025-11",
                "current": false,
                "tech": "分层随机 · 置信区间 · 成本分析",
                "bullets": [
                  "与运营明确实验目标，按历史活跃度分层随机分组，主指标为每名用户支付毛利，并同时跟踪退款和优惠成本。",
                  "实验前检查样本比例、历史指标平衡及预期检验能力，运行中监控券发放失败和跨组领取，记录排除规则。",
                  "输出分层结果与区间估计，发现高活跃组毛利变化不明确，建议仅对低活跃组继续试行，并说明多重比较的探索性质。"
                ]
              }
            ],
            "_config": {
              "moduleName": "分析项目"
            }
          },
          "sortOrder": 3,
          "layout": "left"
        },
        {
          "sectionType": "education",
          "data": {
            "items": [
              {
                "school": "南川统计学院（虚构）",
                "major": "统计学",
                "degree": "本科",
                "startDate": "2020-09",
                "endDate": "2024-06",
                "current": false,
                "description": "相关课程：概率论、数理统计、回归分析、抽样调查与数据库。毕业实践使用公开交易样本完成缺失检查、用户分群与分析报告。"
              }
            ],
            "_config": {
              "moduleName": "教育背景"
            }
          },
          "sortOrder": 4,
          "layout": "right"
        },
        {
          "sectionType": "skills",
          "data": {
            "items": [
              {
                "name": "数据处理",
                "items": [
                  "SQL 窗口函数",
                  "Python/pandas",
                  "数据质量核对"
                ]
              },
              {
                "name": "业务分析",
                "items": [
                  "漏斗与留存",
                  "指标字典",
                  "分群归因"
                ]
              },
              {
                "name": "统计表达",
                "items": [
                  "实验设计基础",
                  "置信区间",
                  "图表与结论边界"
                ]
              }
            ],
            "_config": {
              "moduleName": "分析技能"
            }
          },
          "sortOrder": 5,
          "layout": "right"
        },
        {
          "sectionType": "custom",
          "data": {
            "content": "为每份报告附上数据时间范围、去重规则、过滤条件和可重复查询。异动解释先区分数据问题、结构变化和业务变化，主动向运营确认活动节奏。对观察相关性与实验因果结论使用不同措辞；将需要继续验证的假设和下一步取数需求单独记录，方便业务持续跟踪。",
            "_config": {
              "moduleName": "分析工作习惯"
            }
          },
          "sortOrder": 6,
          "layout": "right"
        }
      ]
    }
  },
  {
    "key": "teacher",
    "name": "教师求职·教学教研",
    "description": "初中语文教师原创范文，适用于1–3 年。教师资质、课堂评价、教学教研；含可编辑完整经历与项目，示例内容请替换为真实经历。",
    "category": "academic",
    "tags": [
      "初中语文教师",
      "1–3 年",
      "单栏",
      "教师资质",
      "课堂评价"
    ],
    "sortOrder": 11,
    "legacyNames": [
      "教育教学"
    ],
    "config": {
      "systemKey": "teacher",
      "layout": "single-column",
      "fonts": [
        "Noto Sans SC",
        "Microsoft YaHei",
        "system-ui"
      ],
      "primaryColor": "#b45309",
      "accentColor": "#b4530912",
      "headerStyle": "underline",
      "sections": [
        "basic",
        "summary",
        "certificates",
        "experience",
        "projects",
        "education",
        "skills"
      ],
      "globalFontSize": 13,
      "globalLineSpacing": 1.55,
      "pageTopMargin": 36,
      "pageBottomMargin": 36,
      "pageLeftMargin": 38,
      "pageRightMargin": 38,
      "moduleMargin": 14,
      "titleTopPadding": 4,
      "titleBottomMargin": 7
    },
    "sample": {
      "version": 1,
      "profile": {
        "key": "teacher",
        "jobTitle": "初中语文教师",
        "experienceLevel": "1–3 年",
        "highlights": [
          "教师资质",
          "课堂评价",
          "教学教研"
        ],
        "suggestedPages": 1
      },
      "sections": [
        {
          "sectionType": "basic",
          "data": {
            "name": "许知遥",
            "jobTitle": "初中语文教师",
            "city": "南京",
            "phone": "138****1011",
            "email": "zhiyao.xu@example.com",
            "links": [],
            "_config": {
              "moduleName": "基本信息"
            }
          },
          "sortOrder": 0,
          "layout": "auto"
        },
        {
          "sectionType": "summary",
          "data": {
            "content": "2023 年 11 月起从事初中语文教学，参与两个年级的阅读与写作课程。注重将教学目标拆为课堂任务，利用作业分析和分层反馈改进教学，也参与班级管理与家校沟通。能够保留评价依据，结合连续观察理解学生进展，避免仅用单次考试成绩判断教学成效。",
            "_config": {
              "moduleName": "教学概述"
            }
          },
          "sortOrder": 1,
          "layout": "auto"
        },
        {
          "sectionType": "certificates",
          "data": {
            "items": [
              {
                "title": "初级中学教师资格（语文，示例）",
                "date": "2023-07",
                "level": "按真实资格替换"
              },
              {
                "title": "普通话水平测试二级甲等（示例）",
                "date": "2022-06",
                "level": "按真实成绩替换"
              }
            ],
            "_config": {
              "moduleName": "专业资质"
            }
          },
          "sortOrder": 2,
          "layout": "auto"
        },
        {
          "sectionType": "experience",
          "data": {
            "items": [
              {
                "company": "明川实验学校（虚构）",
                "position": "语文教师",
                "startDate": "2023-11",
                "endDate": "",
                "current": true,
                "bullets": [
                  "承担 2 个班约 80 名学生的语文教学，按单元准备目标、任务和评价材料，累计完善 12 个单元的教案与练习。",
                  "围绕阅读作业中证据引用不足的问题安排例文标注与二次修改；同一量表下跟踪 3 次作业，完整引用比例由 48% 升至 71%。",
                  "每月组织学情复盘，与班主任和家长讨论学习习惯及支持措施，记录后续执行情况，对需要持续帮助的学生安排定期回访。"
                ]
              },
              {
                "company": "江畔中学（虚构）",
                "position": "语文实习教师",
                "startDate": "2023-02",
                "endDate": "2023-06",
                "current": false,
                "bullets": [
                  "在指导教师带教下完成 16 课时授课与 8 次听评课，根据课堂观察调整提问顺序、板书结构和小组活动时长。",
                  "协助批阅作文并建立常见问题清单，围绕立意、材料与段落衔接提供可执行的建议，记录学生修改后的变化。",
                  "参与班会、阅读节及家长会准备，负责活动材料、学生反馈和过程记录，课后向指导教师汇报观察与反思。"
                ]
              }
            ],
            "_config": {
              "moduleName": "教学经历"
            }
          },
          "sortOrder": 3,
          "layout": "auto"
        },
        {
          "sectionType": "projects",
          "data": {
            "items": [
              {
                "name": "一篇文章的三次修改",
                "role": "课程设计与实施",
                "startDate": "2024-03",
                "endDate": "2024-06",
                "current": false,
                "tech": "写作任务 · 同伴反馈 · 评价量表",
                "bullets": [
                  "设计初稿、同伴反馈和修订稿三阶段任务，将评价拆为观点、材料及衔接，用匿名样例示范如何给出具体修改建议。",
                  "收集 76 份完整修订记录，在同一量表下比较变化，选取 6 组教学示例，保留原稿、反馈和修改稿供年级组备课。",
                  "在教研活动分享任务单与实施反思，说明样本和观察周期，提出下一轮加强同伴反馈训练及跟踪长期迁移的计划。"
                ]
              }
            ],
            "_config": {
              "moduleName": "教学教研"
            }
          },
          "sortOrder": 4,
          "layout": "auto"
        },
        {
          "sectionType": "education",
          "data": {
            "items": [
              {
                "school": "江南师范学院（虚构）",
                "major": "汉语言文学（师范）",
                "degree": "本科",
                "startDate": "2019-09",
                "endDate": "2023-06",
                "current": false,
                "description": "课程包括语文课程与教学论、教育心理学、中国现当代文学与班级管理。完成教育见习和教学实习，保留授课教案、课堂观察和反思材料。"
              }
            ],
            "_config": {
              "moduleName": "教育背景"
            }
          },
          "sortOrder": 5,
          "layout": "auto"
        },
        {
          "sectionType": "skills",
          "data": {
            "items": [
              {
                "name": "课程教学",
                "items": [
                  "单元任务设计",
                  "分层作业",
                  "课堂提问"
                ]
              },
              {
                "name": "评价教研",
                "items": [
                  "作业分析",
                  "评价量表",
                  "听评课记录"
                ]
              },
              {
                "name": "沟通工具",
                "items": [
                  "家校沟通",
                  "互动课件",
                  "Office 学情表"
                ]
              }
            ],
            "_config": {
              "moduleName": "教学技能"
            }
          },
          "sortOrder": 6,
          "layout": "auto"
        }
      ]
    }
  },
  {
    "key": "pharmacist",
    "name": "临床药师·专业资质",
    "description": "临床药师原创范文，适用于3–5 年。药学资质、医嘱审核、用药教育；含可编辑完整经历与项目，示例内容请替换为真实经历。",
    "category": "medical",
    "tags": [
      "临床药师",
      "3–5 年",
      "单栏",
      "药学资质",
      "医嘱审核"
    ],
    "sortOrder": 12,
    "legacyNames": [
      "医疗健康"
    ],
    "config": {
      "systemKey": "pharmacist",
      "layout": "single-column",
      "fonts": [
        "Noto Sans SC",
        "Microsoft YaHei",
        "system-ui"
      ],
      "primaryColor": "#0369a1",
      "accentColor": "#0369a112",
      "headerStyle": "underline",
      "sections": [
        "basic",
        "summary",
        "certificates",
        "experience",
        "projects",
        "education",
        "skills"
      ],
      "globalFontSize": 13,
      "globalLineSpacing": 1.55,
      "pageTopMargin": 36,
      "pageBottomMargin": 36,
      "pageLeftMargin": 38,
      "pageRightMargin": 38,
      "moduleMargin": 14,
      "titleTopPadding": 4,
      "titleBottomMargin": 7
    },
    "sample": {
      "version": 1,
      "profile": {
        "key": "pharmacist",
        "jobTitle": "临床药师",
        "experienceLevel": "3–5 年",
        "highlights": [
          "药学资质",
          "医嘱审核",
          "用药教育"
        ],
        "suggestedPages": 1
      },
      "sections": [
        {
          "sectionType": "basic",
          "data": {
            "name": "林清和",
            "jobTitle": "临床药师",
            "city": "广州",
            "phone": "138****1012",
            "email": "qinghe.lin@example.com",
            "links": [],
            "_config": {
              "moduleName": "基本信息"
            }
          },
          "sortOrder": 0,
          "layout": "auto"
        },
        {
          "sectionType": "summary",
          "data": {
            "content": "2022 年起在医院药学部门工作，参与医嘱审核、病区药学服务与患者用药教育。熟悉常见药学问题的记录和沟通流程，能够结合药品说明书、医院规范及检索资料向带教药师和临床团队反馈，关注用药信息完整性、交接追踪与患者理解。",
            "_config": {
              "moduleName": "专业概述"
            }
          },
          "sortOrder": 1,
          "layout": "auto"
        },
        {
          "sectionType": "certificates",
          "data": {
            "items": [
              {
                "title": "药师专业技术资格（示例）",
                "date": "2023-05",
                "level": "按实际取得情况替换"
              },
              {
                "title": "临床药师规范化培训结业（示例）",
                "date": "2024-06",
                "level": "培训方向：内科药学"
              }
            ],
            "_config": {
              "moduleName": "专业资质"
            }
          },
          "sortOrder": 2,
          "layout": "auto"
        },
        {
          "sectionType": "experience",
          "data": {
            "items": [
              {
                "company": "澄江综合医院（虚构）",
                "position": "临床药师",
                "startDate": "2024-07",
                "endDate": "",
                "current": true,
                "bullets": [
                  "参与内科病区查房与医嘱审核，记录过敏史、既往用药和检验资料完整性，将疑似剂量、重复用药等问题按流程反馈。",
                  "为出院患者提供用药说明，使用清单核对药品名称、使用时点和需关注事项，并通过患者复述确认理解，记录待随访问题。",
                  "每月汇总药学干预记录，与上级药师复核问题分类和采纳情况，在药学讨论中分享典型案例及沟通改进点。"
                ]
              },
              {
                "company": "澄江综合医院（虚构）",
                "position": "药师/规范化培训学员",
                "startDate": "2022-07",
                "endDate": "2024-06",
                "current": false,
                "bullets": [
                  "在带教下完成调剂、审核及内科病区轮转，依照双人核对与交接要求完成日常工作，保留培训学习和考核记录。",
                  "协助整理药物不良反应报告所需信息，按规定去标识并交由上级审核，不独立判断未经确认的因果关系。",
                  "参与药品储存与效期巡查，核对温度记录、近效期清单和异常处理，为常见遗漏补充交接检查提示。"
                ]
              }
            ],
            "_config": {
              "moduleName": "药学经历"
            }
          },
          "sortOrder": 3,
          "layout": "auto"
        },
        {
          "sectionType": "projects",
          "data": {
            "items": [
              {
                "name": "出院用药清单沟通改进",
                "role": "资料整理与随访记录",
                "startDate": "2025-02",
                "endDate": "2025-07",
                "current": false,
                "tech": "清单核对 · 患者教育 · 过程评价",
                "bullets": [
                  "复核 60 份去标识沟通记录，发现药品别名与服用时点解释不清的问题，在上级药师指导下重写患者用语和版式。",
                  "与护士确认出院材料交接节点，为新增、停用和调整药品设置醒目标记，用复述问题检查患者是否能够说清服药安排。",
                  "试行期间抽查 45 份记录，完整说明和理解确认项由 31 份增加至 41 份；仅报告过程指标，不将变化等同临床疗效。"
                ]
              }
            ],
            "_config": {
              "moduleName": "药学改进项目"
            }
          },
          "sortOrder": 4,
          "layout": "auto"
        },
        {
          "sectionType": "education",
          "data": {
            "items": [
              {
                "school": "南岭医药学院（虚构）",
                "major": "临床药学",
                "degree": "本科",
                "startDate": "2017-09",
                "endDate": "2022-06",
                "current": false,
                "description": "学习药理学、临床药物治疗学、药事管理与循证药学。完成医院药学实习，接受药学服务记录、患者隐私保护和专业沟通训练。"
              }
            ],
            "_config": {
              "moduleName": "教育背景"
            }
          },
          "sortOrder": 5,
          "layout": "auto"
        },
        {
          "sectionType": "skills",
          "data": {
            "items": [
              {
                "name": "药学服务",
                "items": [
                  "医嘱信息核对",
                  "用药史采集",
                  "干预记录"
                ]
              },
              {
                "name": "患者沟通",
                "items": [
                  "清单式用药教育",
                  "理解确认",
                  "随访交接"
                ]
              },
              {
                "name": "证据工具",
                "items": [
                  "说明书与文献检索",
                  "质量检查表",
                  "脱敏记录整理"
                ]
              }
            ],
            "_config": {
              "moduleName": "专业技能"
            }
          },
          "sortOrder": 6,
          "layout": "auto"
        }
      ]
    }
  },
  {
    "key": "web-frontend",
    "name": "Web 前端·交互性能",
    "description": "Web 前端开发工程师原创范文，适用于1–3 年。组件设计、交互反馈、性能优化；含可编辑完整经历与项目，示例内容请替换为真实经历。",
    "category": "technical",
    "tags": [
      "Web 前端开发工程师",
      "1–3 年",
      "双栏",
      "组件设计",
      "交互反馈"
    ],
    "sortOrder": 13,
    "legacyNames": [],
    "config": {
      "systemKey": "web-frontend",
      "layout": "two-column",
      "fonts": [
        "Noto Sans SC",
        "Microsoft YaHei",
        "system-ui"
      ],
      "primaryColor": "#1d4ed8",
      "accentColor": "#1d4ed812",
      "headerStyle": "bar",
      "sections": [
        "basic",
        "summary",
        "experience",
        "projects",
        "education",
        "skills",
        "custom"
      ],
      "globalFontSize": 13,
      "globalLineSpacing": 1.55,
      "pageTopMargin": 36,
      "pageBottomMargin": 36,
      "pageLeftMargin": 38,
      "pageRightMargin": 38,
      "moduleMargin": 14,
      "titleTopPadding": 4,
      "titleBottomMargin": 7
    },
    "sample": {
      "version": 1,
      "profile": {
        "key": "web-frontend",
        "jobTitle": "Web 前端开发工程师",
        "experienceLevel": "1–3 年",
        "highlights": [
          "组件设计",
          "交互反馈",
          "性能优化"
        ],
        "suggestedPages": 1
      },
      "sections": [
        {
          "sectionType": "basic",
          "data": {
            "name": "陆景澄",
            "jobTitle": "Web 前端开发工程师",
            "city": "杭州",
            "phone": "138****1013",
            "email": "jingcheng.lu@example.com",
            "links": [],
            "_config": {
              "moduleName": "基本信息"
            }
          },
          "sortOrder": 0,
          "layout": "auto"
        },
        {
          "sectionType": "summary",
          "data": {
            "content": "2024 年起从事 Web 前端开发，主要参与企业后台与客户门户建设。能够使用 React、TypeScript 完成交互、状态和接口接入，关注复杂表单的反馈、页面加载和维护成本。习惯用浏览器性能记录与可重复场景定位问题，和设计、后端共同明确边界状态。",
            "_config": {
              "moduleName": "职业概述"
            }
          },
          "sortOrder": 1,
          "layout": "left"
        },
        {
          "sectionType": "experience",
          "data": {
            "items": [
              {
                "company": "轻舟协作科技（虚构）",
                "position": "前端开发工程师",
                "startDate": "2024-07",
                "endDate": "",
                "current": true,
                "bullets": [
                  "负责客户档案、任务分派和数据导入页面，使用 React 与 TypeScript 交付 18 个业务页面，统一加载、错误和空结果状态。",
                  "将重复的筛选、分页及列配置抽为可组合模块，保留业务侧自定义入口，支持 4 个列表页面逐步迁移并补充使用示例。",
                  "参与接口与设计评审，针对提交重复、权限失效和网络中断补齐反馈；上线后使用错误记录定位问题并跟进修复。"
                ]
              }
            ],
            "_config": {
              "moduleName": "开发经历"
            }
          },
          "sortOrder": 2,
          "layout": "right"
        },
        {
          "sectionType": "projects",
          "data": {
            "items": [
              {
                "name": "客户门户首屏与表单改进",
                "role": "前端实现",
                "startDate": "2025-01",
                "endDate": "2025-05",
                "current": false,
                "tech": "React · Vite · Performance 面板",
                "bullets": [
                  "在固定设备和限速条件下记录首页资源与长任务，发现图表包提前加载和重复取数，拆分路由资源并合并请求。",
                  "对照相同缓存与网络条件复测，首屏可交互时间中位数从 3.2 秒降至 1.9 秒，同时记录低性能设备和冷启动结果。",
                  "改写资料表单的字段级校验、保存提示和草稿恢复，邀请客服按真实任务走查，修正键盘焦点与错误定位问题。"
                ]
              },
              {
                "name": "批量导入进度组件",
                "role": "组件与交互开发",
                "startDate": "2025-08",
                "endDate": "2025-11",
                "current": false,
                "tech": "TypeScript · 状态机 · 文件处理",
                "bullets": [
                  "将上传、解析、确认和完成拆为明确状态，与后端约定错误文件、部分失败和任务过期的返回结构及处理动作。",
                  "实现分步校验、轮询取消和重复提交保护，在切换页面后保留任务标识，重新进入时能够恢复进度与结果说明。",
                  "以 15 组脱敏文件验证空表、错列、大文件和重复编号等情况，补齐使用文档，供两个业务模块复用。"
                ]
              }
            ],
            "_config": {
              "moduleName": "工程项目"
            }
          },
          "sortOrder": 3,
          "layout": "left"
        },
        {
          "sectionType": "education",
          "data": {
            "items": [
              {
                "school": "江城信息学院（虚构）",
                "major": "计算机科学与技术",
                "degree": "本科",
                "startDate": "2020-09",
                "endDate": "2024-06",
                "current": false,
                "description": "课程包括数据结构、Web 开发、数据库与计算机网络。毕业设计为实验室预约工具，负责交互、接口联调和移动端适配。"
              }
            ],
            "_config": {
              "moduleName": "教育背景"
            }
          },
          "sortOrder": 4,
          "layout": "right"
        },
        {
          "sectionType": "skills",
          "data": {
            "items": [
              {
                "name": "前端基础",
                "items": [
                  "HTML 语义与 CSS",
                  "JavaScript/TypeScript",
                  "浏览器事件"
                ]
              },
              {
                "name": "应用开发",
                "items": [
                  "React Hooks",
                  "组件组合",
                  "表单与请求状态"
                ]
              },
              {
                "name": "工程调试",
                "items": [
                  "Vite 资源分析",
                  "性能记录",
                  "键盘与响应式走查"
                ]
              }
            ],
            "_config": {
              "moduleName": "技术技能"
            }
          },
          "sortOrder": 5,
          "layout": "right"
        },
        {
          "sectionType": "custom",
          "data": {
            "content": "提交组件时同步提供最小使用示例、状态说明和业务扩展点。接口联调前列出分页、鉴权、超时及字段缺失场景，避免依赖正常返回的演示数据。修复问题先记录触发条件和浏览器环境，再核对影响页面；发布后根据错误记录和业务反馈追踪结果，持续缩小回归范围。",
            "_config": {
              "moduleName": "协作与维护"
            }
          },
          "sortOrder": 6,
          "layout": "right"
        }
      ]
    }
  },
  {
    "key": "qa-engineer",
    "name": "软件测试·质量保障",
    "description": "软件测试工程师原创范文，适用于1–3 年。风险分析、接口自动化、缺陷闭环；含可编辑完整经历与项目，示例内容请替换为真实经历。",
    "category": "technical",
    "tags": [
      "软件测试工程师",
      "1–3 年",
      "单栏",
      "风险分析",
      "接口自动化"
    ],
    "sortOrder": 14,
    "legacyNames": [],
    "config": {
      "systemKey": "qa-engineer",
      "layout": "single-column",
      "fonts": [
        "Noto Sans SC",
        "Microsoft YaHei",
        "system-ui"
      ],
      "primaryColor": "#4338ca",
      "accentColor": "#4338ca12",
      "headerStyle": "underline",
      "sections": [
        "basic",
        "summary",
        "experience",
        "projects",
        "education",
        "skills",
        "custom"
      ],
      "globalFontSize": 13,
      "globalLineSpacing": 1.55,
      "pageTopMargin": 36,
      "pageBottomMargin": 36,
      "pageLeftMargin": 38,
      "pageRightMargin": 38,
      "moduleMargin": 14,
      "titleTopPadding": 4,
      "titleBottomMargin": 7
    },
    "sample": {
      "version": 1,
      "profile": {
        "key": "qa-engineer",
        "jobTitle": "软件测试工程师",
        "experienceLevel": "1–3 年",
        "highlights": [
          "风险分析",
          "接口自动化",
          "缺陷闭环"
        ],
        "suggestedPages": 1
      },
      "sections": [
        {
          "sectionType": "basic",
          "data": {
            "name": "程安序",
            "jobTitle": "软件测试工程师",
            "city": "成都",
            "phone": "138****1014",
            "email": "anxu.cheng@example.com",
            "links": [],
            "_config": {
              "moduleName": "基本信息"
            }
          },
          "sortOrder": 0,
          "layout": "auto"
        },
        {
          "sectionType": "summary",
          "data": {
            "content": "2024 年起从事企业软件测试，覆盖订单、权限与批量任务等场景。能够从需求状态、数据边界和系统依赖识别风险，设计接口与页面测试，使用 Python 维护可重复执行的回归集。重视缺陷复现、修复验证和发布后的实际表现，清楚说明测试覆盖及遗留风险。",
            "_config": {
              "moduleName": "职业概述"
            }
          },
          "sortOrder": 1,
          "layout": "auto"
        },
        {
          "sectionType": "experience",
          "data": {
            "items": [
              {
                "company": "川原企业软件（虚构）",
                "position": "测试工程师",
                "startDate": "2024-07",
                "endDate": "",
                "current": true,
                "bullets": [
                  "参与订单与权限模块的需求评审，将角色、状态和异常依赖拆为测试矩阵，维护 320 条核心场景并随版本调整。",
                  "负责接口、页面和数据库结果核对，对高风险缺陷提供最小复现步骤、请求数据与日志时间，帮助研发快速定位。",
                  "每轮发布输出覆盖结果和遗留问题，按业务影响建议修复顺序；上线后观察客服反馈，对漏测原因补充对应场景。"
                ]
              }
            ],
            "_config": {
              "moduleName": "工作经历"
            }
          },
          "sortOrder": 2,
          "layout": "auto"
        },
        {
          "sectionType": "projects",
          "data": {
            "items": [
              {
                "name": "订单状态接口回归集",
                "role": "测试设计与脚本维护",
                "startDate": "2025-01",
                "endDate": "2025-06",
                "current": false,
                "tech": "Python · pytest · SQL",
                "bullets": [
                  "围绕支付、取消、超时及退款建立状态迁移表，覆盖重复回调、消息晚到和金额边界，明确每个接口的预期业务状态。",
                  "编写可独立准备和清理数据的接口用例，将测试账号、环境地址与业务断言分开，避免用例依赖固定执行顺序。",
                  "接入版本回归后持续记录误报，将时间等待改为有上限的状态轮询；82 条核心用例稳定运行，为人工检查留出探索时间。"
                ]
              },
              {
                "name": "批量导出可靠性验证",
                "role": "专项测试执行",
                "startDate": "2025-08",
                "endDate": "2025-10",
                "current": false,
                "tech": "边界数据 · 故障模拟 · 浏览器检查",
                "bullets": [
                  "按数据量、字段长度和权限建立组合样本，核对导出条数、中文字符与金额精度，并检查文件访问权限和过期行为。",
                  "模拟节点重启、请求超时和重复下载，观察任务是否恢复、文件是否完整，将问题记录与任务标识关联供研发分析。",
                  "整理 27 个专项场景及验收证据，推动修复大文件取消后的资源清理问题，发布说明保留尚未覆盖的环境限制。"
                ]
              }
            ],
            "_config": {
              "moduleName": "质量项目"
            }
          },
          "sortOrder": 3,
          "layout": "auto"
        },
        {
          "sectionType": "education",
          "data": {
            "items": [
              {
                "school": "西岭软件学院（虚构）",
                "major": "软件工程",
                "degree": "本科",
                "startDate": "2020-09",
                "endDate": "2024-06",
                "current": false,
                "description": "学习软件测试、数据库、计算机网络与程序设计。课程项目负责图书借阅服务的测试计划、接口用例和缺陷跟踪。"
              }
            ],
            "_config": {
              "moduleName": "教育背景"
            }
          },
          "sortOrder": 4,
          "layout": "auto"
        },
        {
          "sectionType": "skills",
          "data": {
            "items": [
              {
                "name": "测试设计",
                "items": [
                  "等价类与边界值",
                  "状态迁移",
                  "风险分层"
                ]
              },
              {
                "name": "执行工具",
                "items": [
                  "Python/pytest",
                  "接口调试",
                  "SQL 数据核对"
                ]
              },
              {
                "name": "质量协作",
                "items": [
                  "缺陷最小复现",
                  "发布风险说明",
                  "日志关联分析"
                ]
              }
            ],
            "_config": {
              "moduleName": "测试技能"
            }
          },
          "sortOrder": 5,
          "layout": "auto"
        },
        {
          "sectionType": "custom",
          "data": {
            "content": "用例记录业务目标、前置数据、操作与断言，保持关键场景可由他人复现。对偶发问题记录出现频率、环境与并发条件，避免仅以一次通过关闭问题。复盘时区分需求遗漏、环境差异与用例不足，选择能覆盖风险的检查方式；自动化报告同时展示失败原因和人工确认结论。",
            "_config": {
              "moduleName": "质量记录"
            }
          },
          "sortOrder": 6,
          "layout": "auto"
        }
      ]
    }
  },
  {
    "key": "algorithm-engineer",
    "name": "算法工程·实验落地",
    "description": "算法工程师原创范文，适用于1–3 年。数据划分、误差分析、部署约束；含可编辑完整经历与项目，示例内容请替换为真实经历。",
    "category": "technical",
    "tags": [
      "算法工程师",
      "1–3 年",
      "双栏",
      "数据划分",
      "误差分析"
    ],
    "sortOrder": 15,
    "legacyNames": [],
    "config": {
      "systemKey": "algorithm-engineer",
      "layout": "two-column",
      "fonts": [
        "Noto Sans SC",
        "Microsoft YaHei",
        "system-ui"
      ],
      "primaryColor": "#6d28d9",
      "accentColor": "#6d28d912",
      "headerStyle": "bar",
      "sections": [
        "basic",
        "summary",
        "experience",
        "projects",
        "education",
        "skills",
        "custom"
      ],
      "globalFontSize": 13,
      "globalLineSpacing": 1.55,
      "pageTopMargin": 36,
      "pageBottomMargin": 36,
      "pageLeftMargin": 38,
      "pageRightMargin": 38,
      "moduleMargin": 14,
      "titleTopPadding": 4,
      "titleBottomMargin": 7
    },
    "sample": {
      "version": 1,
      "profile": {
        "key": "algorithm-engineer",
        "jobTitle": "算法工程师",
        "experienceLevel": "1–3 年",
        "highlights": [
          "数据划分",
          "误差分析",
          "部署约束"
        ],
        "suggestedPages": 1
      },
      "sections": [
        {
          "sectionType": "basic",
          "data": {
            "name": "邵景言",
            "jobTitle": "算法工程师",
            "city": "北京",
            "phone": "138****1015",
            "email": "jingyan.shao@example.com",
            "links": [],
            "_config": {
              "moduleName": "基本信息"
            }
          },
          "sortOrder": 0,
          "layout": "auto"
        },
        {
          "sectionType": "summary",
          "data": {
            "content": "2024 年硕士毕业后从事文本分类与检索算法工作，参与数据标注、基线建立、误差分析和服务联调。能够在业务约束下比较模型效果与推理成本，保留数据版本、划分规则和实验记录；关注离线指标与实际使用差异，不将单次实验提升直接等同业务收益。",
            "_config": {
              "moduleName": "职业概述"
            }
          },
          "sortOrder": 1,
          "layout": "left"
        },
        {
          "sectionType": "experience",
          "data": {
            "items": [
              {
                "company": "知语智能科技（虚构）",
                "position": "算法工程师",
                "startDate": "2024-07",
                "endDate": "",
                "current": true,
                "bullets": [
                  "负责客服工单分类的数据检查与模型迭代，和业务共同明确 18 类标签及冲突规则，对模糊样本保留人工复核入口。",
                  "维护去重、时间切分和样本来源说明，先复现轻量基线再比较编码器方案，统一评估脚本并记录参数和随机种子。",
                  "与后端约定超时、低置信度及模型不可用的回退行为，参与灰度观察，把误判样例和线上分布变化纳入后续迭代。"
                ]
              }
            ],
            "_config": {
              "moduleName": "工作经历"
            }
          },
          "sortOrder": 2,
          "layout": "right"
        },
        {
          "sectionType": "projects",
          "data": {
            "items": [
              {
                "name": "工单分派分类模型",
                "role": "训练与误差分析",
                "startDate": "2024-09",
                "endDate": "2025-03",
                "current": false,
                "tech": "Python · PyTorch · 文本分类",
                "bullets": [
                  "整理 3.6 万条去标识工单，按时间划分训练与验证集合，清理近重复文本，抽查历史转派记录与标签是否一致。",
                  "比较词袋线性模型和预训练编码器，在固定测试集上宏平均 F1 从 0.78 升至 0.84，重点复核长尾类与相近标签混淆。",
                  "针对低置信度样本保留人工分派，在统一硬件上测试批量和单条时延，输出阈值、资源消耗与适用范围供上线评审。"
                ]
              },
              {
                "name": "知识库检索排序试验",
                "role": "评估集与实验",
                "startDate": "2025-06",
                "endDate": "2025-11",
                "current": false,
                "tech": "BM25 · 向量检索 · 重排",
                "bullets": [
                  "从脱敏检索日志抽取 300 个查询，由两位业务同事标注相关文档，记录分歧和仲裁，区分事实查找与流程咨询。",
                  "建立 BM25 基线，对比向量召回及重排组合，使用固定查询集评估召回与排序质量，另列过期文档和无答案样例。",
                  "把检索过滤、索引更新和推理耗时纳入方案比较，形成离线实验报告；建议先试点并观察人工采纳，不提前宣称减少工单。"
                ]
              }
            ],
            "_config": {
              "moduleName": "算法项目"
            }
          },
          "sortOrder": 3,
          "layout": "left"
        },
        {
          "sectionType": "education",
          "data": {
            "items": [
              {
                "school": "北川理工学院（虚构）",
                "major": "计算机技术",
                "degree": "硕士",
                "startDate": "2021-09",
                "endDate": "2024-06",
                "current": false,
                "description": "本科为同校计算机科学与技术（2017.09–2021.06）。研究生课程包括机器学习、概率模型与信息检索；学位研究完成文本分类复现与数据偏差分析。"
              }
            ],
            "_config": {
              "moduleName": "教育背景"
            }
          },
          "sortOrder": 4,
          "layout": "right"
        },
        {
          "sectionType": "skills",
          "data": {
            "items": [
              {
                "name": "数据实验",
                "items": [
                  "数据质量与划分",
                  "基线与消融",
                  "分层误差分析"
                ]
              },
              {
                "name": "模型工具",
                "items": [
                  "Python/PyTorch",
                  "文本编码器",
                  "检索与重排基础"
                ]
              },
              {
                "name": "工程协作",
                "items": [
                  "评估脚本",
                  "推理时延测试",
                  "灰度与回退约定"
                ]
              }
            ],
            "_config": {
              "moduleName": "算法技能"
            }
          },
          "sortOrder": 5,
          "layout": "right"
        },
        {
          "sectionType": "custom",
          "data": {
            "content": "每次实验保存数据清单、划分摘要、代码版本与运行参数，先检查数据泄漏和标签偏差再讨论指标。报告同时呈现总体、长尾类别及困难样本结果，说明置信度阈值和人工复核成本；对离线评估无法覆盖的新主题和过期知识，单独记录上线观察计划与退出条件。",
            "_config": {
              "moduleName": "实验复核"
            }
          },
          "sortOrder": 6,
          "layout": "right"
        }
      ]
    }
  },
  {
    "key": "growth-operations",
    "name": "用户运营·增长留存",
    "description": "用户运营专员原创范文，适用于1–3 年。用户分层、生命周期、留存复盘；含可编辑完整经历与项目，示例内容请替换为真实经历。",
    "category": "product",
    "tags": [
      "用户运营专员",
      "1–3 年",
      "单栏",
      "用户分层",
      "生命周期"
    ],
    "sortOrder": 16,
    "legacyNames": [],
    "config": {
      "systemKey": "growth-operations",
      "layout": "single-column",
      "fonts": [
        "Noto Sans SC",
        "Microsoft YaHei",
        "system-ui"
      ],
      "primaryColor": "#ea580c",
      "accentColor": "#ea580c12",
      "headerStyle": "underline",
      "sections": [
        "basic",
        "summary",
        "experience",
        "projects",
        "education",
        "skills",
        "custom"
      ],
      "globalFontSize": 13,
      "globalLineSpacing": 1.55,
      "pageTopMargin": 36,
      "pageBottomMargin": 36,
      "pageLeftMargin": 38,
      "pageRightMargin": 38,
      "moduleMargin": 14,
      "titleTopPadding": 4,
      "titleBottomMargin": 7
    },
    "sample": {
      "version": 1,
      "profile": {
        "key": "growth-operations",
        "jobTitle": "用户运营专员",
        "experienceLevel": "1–3 年",
        "highlights": [
          "用户分层",
          "生命周期",
          "留存复盘"
        ],
        "suggestedPages": 1
      },
      "sections": [
        {
          "sectionType": "basic",
          "data": {
            "name": "唐星宁",
            "jobTitle": "用户运营专员",
            "city": "上海",
            "phone": "138****1016",
            "email": "xingning.tang@example.com",
            "links": [],
            "_config": {
              "moduleName": "基本信息"
            }
          },
          "sortOrder": 0,
          "layout": "auto"
        },
        {
          "sectionType": "summary",
          "data": {
            "content": "2024 年起从事线上学习产品用户运营，围绕新用户引导、社群服务和沉默用户回访开展工作。能够按生命周期组织触达与服务，结合活动记录和用户反馈调整流程。关注用户真实任务与沟通频次，使用明确口径观察参与、完成与后续留存，不以单次活动热度代替长期效果。",
            "_config": {
              "moduleName": "职业概述"
            }
          },
          "sortOrder": 1,
          "layout": "auto"
        },
        {
          "sectionType": "experience",
          "data": {
            "items": [
              {
                "company": "拾光学习科技（虚构）",
                "position": "用户运营专员",
                "startDate": "2024-07",
                "endDate": "",
                "current": true,
                "bullets": [
                  "负责新用户七日引导，按注册、首课和连续学习状态维护触达清单，与客服确认未开始学习用户的主要阻碍。",
                  "管理 6 个学习社群的内容排期和答疑收口，整理共性问题交给教研与产品，减少用户在不同渠道重复描述问题。",
                  "每周核对活动报名、任务完成和退款记录，区分重复参与与新增用户，向负责人汇报服务投入、反馈和后续追踪安排。"
                ]
              }
            ],
            "_config": {
              "moduleName": "运营经历"
            }
          },
          "sortOrder": 2,
          "layout": "auto"
        },
        {
          "sectionType": "projects",
          "data": {
            "items": [
              {
                "name": "新用户首周陪伴计划",
                "role": "流程设计与执行",
                "startDate": "2025-01",
                "endDate": "2025-04",
                "current": false,
                "tech": "用户分层 · 服务脚本 · 分组观察",
                "bullets": [
                  "根据 42 次回访整理设备操作、课程选择和时间安排三类困难，为不同阶段用户设计可选择的引导与求助入口。",
                  "与产品设置按状态发送的提醒，限制频率并提供退出方式；为社群管理员编写交接表和异常升级说明。",
                  "在相邻两期同来源用户中观察，首课完成比例由 57% 升至 66%；复盘注明同期课程差异，建议继续分组验证后再扩大。"
                ]
              },
              {
                "name": "沉默用户需求回访",
                "role": "分群与反馈整理",
                "startDate": "2025-08",
                "endDate": "2025-11",
                "current": false,
                "tech": "回访提纲 · 任务追踪 · 复盘",
                "bullets": [
                  "按距上次学习时长和历史付费状态抽取回访名单，排除已拒绝联系者，明确回访目的是了解阻碍和提供支持。",
                  "整理 86 份有效反馈，将课程难度、时间不足和使用问题分别转交，记录负责人、回复时点与用户是否接受方案。",
                  "跟踪两周内的再次学习与咨询情况，汇总可改进的课程入口和学习计划建议，不把自然回流全部归因为运营触达。"
                ]
              }
            ],
            "_config": {
              "moduleName": "运营项目"
            }
          },
          "sortOrder": 3,
          "layout": "auto"
        },
        {
          "sectionType": "education",
          "data": {
            "items": [
              {
                "school": "海川传媒学院（虚构）",
                "major": "市场营销",
                "degree": "本科",
                "startDate": "2020-09",
                "endDate": "2024-06",
                "current": false,
                "description": "相关课程：消费者行为、市场研究、统计学和服务营销。毕业实践完成线上课程使用访谈，训练问卷整理、用户分群与建议表达。"
              }
            ],
            "_config": {
              "moduleName": "教育背景"
            }
          },
          "sortOrder": 4,
          "layout": "auto"
        },
        {
          "sectionType": "skills",
          "data": {
            "items": [
              {
                "name": "用户服务",
                "items": [
                  "生命周期分层",
                  "回访与社群",
                  "问题升级"
                ]
              },
              {
                "name": "活动执行",
                "items": [
                  "排期与分工",
                  "触达脚本",
                  "过程记录"
                ]
              },
              {
                "name": "数据工具",
                "items": [
                  "Excel 透视表",
                  "基础 SQL",
                  "留存口径与复盘"
                ]
              }
            ],
            "_config": {
              "moduleName": "运营技能"
            }
          },
          "sortOrder": 5,
          "layout": "auto"
        },
        {
          "sectionType": "custom",
          "data": {
            "content": "将高频问题整理为入门指南、课程选择提示和学习计划示例，每月与教研及客服核对更新。社群活动使用可完成的小任务和明确反馈，记录用户主动求助及退出原因。运营复盘同时保留未响应者和负面反馈，避免仅展示活跃用户的积极案例，便于团队判断服务边界与资源安排。",
            "_config": {
              "moduleName": "服务内容沉淀"
            }
          },
          "sortOrder": 6,
          "layout": "auto"
        }
      ]
    }
  },
  {
    "key": "content-operations",
    "name": "新媒体运营·内容策划",
    "description": "新媒体内容运营原创范文，适用于1–3 年。选题策划、内容生产、分发复盘；含可编辑完整经历与项目，示例内容请替换为真实经历。",
    "category": "product",
    "tags": [
      "新媒体内容运营",
      "1–3 年",
      "单栏",
      "选题策划",
      "内容生产"
    ],
    "sortOrder": 17,
    "legacyNames": [],
    "config": {
      "systemKey": "content-operations",
      "layout": "single-column",
      "fonts": [
        "Noto Sans SC",
        "Microsoft YaHei",
        "system-ui"
      ],
      "primaryColor": "#c2410c",
      "accentColor": "#c2410c12",
      "headerStyle": "underline",
      "sections": [
        "basic",
        "summary",
        "experience",
        "projects",
        "education",
        "skills",
        "custom"
      ],
      "globalFontSize": 13,
      "globalLineSpacing": 1.55,
      "pageTopMargin": 36,
      "pageBottomMargin": 36,
      "pageLeftMargin": 38,
      "pageRightMargin": 38,
      "moduleMargin": 14,
      "titleTopPadding": 4,
      "titleBottomMargin": 7
    },
    "sample": {
      "version": 1,
      "profile": {
        "key": "content-operations",
        "jobTitle": "新媒体内容运营",
        "experienceLevel": "1–3 年",
        "highlights": [
          "选题策划",
          "内容生产",
          "分发复盘"
        ],
        "suggestedPages": 1
      },
      "sections": [
        {
          "sectionType": "basic",
          "data": {
            "name": "宋知微",
            "jobTitle": "新媒体内容运营",
            "city": "广州",
            "phone": "138****1017",
            "email": "zhiwei.song@example.com",
            "links": [],
            "_config": {
              "moduleName": "基本信息"
            }
          },
          "sortOrder": 0,
          "layout": "auto"
        },
        {
          "sectionType": "summary",
          "data": {
            "content": "2024 年起从事生活消费品牌内容运营，负责选题、图文编辑、短视频脚本与多渠道分发。能够围绕目标人群的问题组织内容，在制作前明确事实来源与表达边界，和设计、客服协作完成校对。复盘同时观察阅读质量、有效咨询与制作成本，形成可持续的内容计划。",
            "_config": {
              "moduleName": "职业概述"
            }
          },
          "sortOrder": 1,
          "layout": "auto"
        },
        {
          "sectionType": "experience",
          "data": {
            "items": [
              {
                "company": "禾见生活品牌（虚构）",
                "position": "内容运营专员",
                "startDate": "2024-07",
                "endDate": "",
                "current": true,
                "bullets": [
                  "维护公众号与短视频账号的周度选题表，从客服咨询、搜索词和产品使用场景提取问题，说明目标读者与内容价值。",
                  "每月交付约 8 篇图文和 12 条短视频脚本，协调拍摄、设计与校对；涉及功能和材料的表述由产品负责人复核。",
                  "建立内容台账，记录题材、发布时间、自然与付费流量来源，按周比较完读、收藏和有效咨询，减少仅追逐播放量的判断。"
                ]
              }
            ],
            "_config": {
              "moduleName": "工作经历"
            }
          },
          "sortOrder": 2,
          "layout": "auto"
        },
        {
          "sectionType": "projects",
          "data": {
            "items": [
              {
                "name": "新手收纳实用内容系列",
                "role": "选题与制作统筹",
                "startDate": "2025-02",
                "endDate": "2025-06",
                "current": false,
                "tech": "用户问题 · 脚本 · 图文分发",
                "bullets": [
                  "从 180 条去标识咨询中筛出空间测量、物品分类和维护三个主题，设计 10 期系列，分别说明读者任务和演示步骤。",
                  "与摄影及产品同事完成场景实拍，先展示适用条件再呈现操作，用字幕与图示补齐尺寸、材料等容易误解的信息。",
                  "按同等曝光口径比较前后两组内容，收藏率由 2.1% 升至 3.4%；同步整理 37 条有效咨询，注明非随机发布的比较限制。"
                ]
              },
              {
                "name": "内容生产校对流程优化",
                "role": "流程与资料整理",
                "startDate": "2025-08",
                "endDate": "2025-11",
                "current": false,
                "tech": "编辑清单 · 素材管理 · 复盘",
                "bullets": [
                  "复盘过去 24 条内容的返修记录，把事实核对、字幕错误和素材缺失列为前置检查项，明确每项的确认责任人。",
                  "统一脚本、授权素材与成片版本命名，制作分发尺寸清单，让设计与运营能快速定位最终文件和对应说明。",
                  "选择两个月内容试行，二次返修从首月 11 条降至次月 5 条，记录新增制作投入，保留对不同题材适用性的观察。"
                ]
              }
            ],
            "_config": {
              "moduleName": "内容项目"
            }
          },
          "sortOrder": 3,
          "layout": "auto"
        },
        {
          "sectionType": "education",
          "data": {
            "items": [
              {
                "school": "南湾传媒学院（虚构）",
                "major": "网络与新媒体",
                "degree": "本科",
                "startDate": "2020-09",
                "endDate": "2024-06",
                "current": false,
                "description": "学习传播学、新闻采访、视听语言与数据分析。毕业作品完成城市生活服务专题，负责采访、资料核对、脚本和多平台编辑。"
              }
            ],
            "_config": {
              "moduleName": "教育背景"
            }
          },
          "sortOrder": 4,
          "layout": "auto"
        },
        {
          "sectionType": "skills",
          "data": {
            "items": [
              {
                "name": "策划编辑",
                "items": [
                  "问题导向选题",
                  "采访与事实核对",
                  "标题与脚本"
                ]
              },
              {
                "name": "制作协作",
                "items": [
                  "剪映基础剪辑",
                  "图文排版",
                  "素材授权与版本"
                ]
              },
              {
                "name": "效果复盘",
                "items": [
                  "渠道数据台账",
                  "完读与收藏",
                  "咨询归类与归因边界"
                ]
              }
            ],
            "_config": {
              "moduleName": "内容技能"
            }
          },
          "sortOrder": 5,
          "layout": "auto"
        },
        {
          "sectionType": "custom",
          "data": {
            "content": "作品集示例地址：portfolio.example.com/zhiwei。每个案例附选题依据、脚本版本、本人职责和发布后的反馈，区分自然与付费数据。对团队拍摄作品注明摄影与设计贡献；涉及他人形象或客户材料时先确认展示权限。实际求职时替换为真实可公开作品，并保留数据时间范围和口径。",
            "_config": {
              "moduleName": "作品集说明"
            }
          },
          "sortOrder": 6,
          "layout": "auto"
        }
      ]
    }
  },
  {
    "key": "finance-accounting",
    "name": "财务会计·核算分析",
    "description": "财务会计原创范文，适用于1–3 年。核算对账、月结质量、预算跟踪；含可编辑完整经历与项目，示例内容请替换为真实经历。",
    "category": "business",
    "tags": [
      "财务会计",
      "1–3 年",
      "单栏",
      "核算对账",
      "月结质量"
    ],
    "sortOrder": 18,
    "legacyNames": [],
    "config": {
      "systemKey": "finance-accounting",
      "layout": "single-column",
      "fonts": [
        "Noto Sans SC",
        "Microsoft YaHei",
        "system-ui"
      ],
      "primaryColor": "#334155",
      "accentColor": "#33415512",
      "headerStyle": "underline",
      "sections": [
        "basic",
        "summary",
        "experience",
        "projects",
        "education",
        "skills",
        "certificates"
      ],
      "globalFontSize": 13,
      "globalLineSpacing": 1.55,
      "pageTopMargin": 36,
      "pageBottomMargin": 36,
      "pageLeftMargin": 38,
      "pageRightMargin": 38,
      "moduleMargin": 14,
      "titleTopPadding": 4,
      "titleBottomMargin": 7
    },
    "sample": {
      "version": 1,
      "profile": {
        "key": "finance-accounting",
        "jobTitle": "财务会计",
        "experienceLevel": "1–3 年",
        "highlights": [
          "核算对账",
          "月结质量",
          "预算跟踪"
        ],
        "suggestedPages": 1
      },
      "sections": [
        {
          "sectionType": "basic",
          "data": {
            "name": "许清越",
            "jobTitle": "财务会计",
            "city": "苏州",
            "phone": "138****1018",
            "email": "qingyue.xu@example.com",
            "links": [],
            "_config": {
              "moduleName": "基本信息"
            }
          },
          "sortOrder": 0,
          "layout": "auto"
        },
        {
          "sectionType": "summary",
          "data": {
            "content": "2024 年起从事制造企业财务核算，主要承担费用审核、应付对账和月结底表整理。能够按既定会计政策检查单据、归属期间和科目，及时记录差异并向负责人反馈；参与预算执行分析，重视原始凭据、复核轨迹与财务数据的可追溯性。",
            "_config": {
              "moduleName": "职业概述"
            }
          },
          "sortOrder": 1,
          "layout": "auto"
        },
        {
          "sectionType": "experience",
          "data": {
            "items": [
              {
                "company": "青衡精密制造（虚构）",
                "position": "财务会计",
                "startDate": "2024-07",
                "endDate": "",
                "current": true,
                "bullets": [
                  "负责费用报销与应付单据的初审，核对合同、验收及发票信息，按月整理约 260 笔凭证资料，异常事项交由主管复核。",
                  "每月与 18 家常用供应商对账，区分未达票、暂估与价格差异，登记形成原因、责任部门和后续处理，保留双方确认依据。",
                  "参与结账检查和费用分析，按归属期间复核摊销与预提底表，将预算偏差拆为数量、价格和时间因素，供负责人解释经营变化。"
                ]
              }
            ],
            "_config": {
              "moduleName": "工作经历"
            }
          },
          "sortOrder": 2,
          "layout": "auto"
        },
        {
          "sectionType": "projects",
          "data": {
            "items": [
              {
                "name": "应付对账差异跟踪表",
                "role": "底表设计与核对",
                "startDate": "2025-01",
                "endDate": "2025-04",
                "current": false,
                "tech": "Excel · 差异分类 · 资料归档",
                "bullets": [
                  "抽取三个月对账记录，发现差异在邮件中分散且缺少关闭证据，与采购和仓库确认收货、发票及付款的关联字段。",
                  "用统一编号连接合同、入库和发票，设置差异类别、处理人及预计关闭月，月末按账龄提醒需升级的事项。",
                  "连续两个月核对后，未注明原因的差异从 23 项降至 7 项；保留暂估与未达票明细，未将登记完整度当作现金节约。"
                ]
              },
              {
                "name": "部门费用预算执行底表",
                "role": "数据整理与分析",
                "startDate": "2025-07",
                "endDate": "2025-10",
                "current": false,
                "tech": "预算口径 · 透视表 · 月度分析",
                "bullets": [
                  "将费用凭证与部门、预算项目对应，复核跨部门分摊规则，分别展示已发生、已承诺与尚未入账事项，避免重复计算。",
                  "设计月度和累计执行两种视图，对异常波动回查业务说明，与部门助理确认费用发生时间及一次性事项。",
                  "为财务主管准备偏差清单和解释材料，记录预算调整版本；试行三个月后把核对步骤写入月结工作指引。"
                ]
              }
            ],
            "_config": {
              "moduleName": "财务改进项目"
            }
          },
          "sortOrder": 3,
          "layout": "auto"
        },
        {
          "sectionType": "education",
          "data": {
            "items": [
              {
                "school": "江南财经学院（虚构）",
                "major": "会计学",
                "degree": "本科",
                "startDate": "2020-09",
                "endDate": "2024-06",
                "current": false,
                "description": "相关课程：中级财务会计、成本会计、财务管理、审计和税法。课程实践完成模拟制造企业账务、成本分配和财务报表勾稽核对。"
              }
            ],
            "_config": {
              "moduleName": "教育背景"
            }
          },
          "sortOrder": 4,
          "layout": "auto"
        },
        {
          "sectionType": "skills",
          "data": {
            "items": [
              {
                "name": "核算基础",
                "items": [
                  "费用与应付核算",
                  "凭证资料核验",
                  "月结底表"
                ]
              },
              {
                "name": "分析工具",
                "items": [
                  "Excel 查找与透视",
                  "财务系统导表",
                  "勾稽与差异检查"
                ]
              },
              {
                "name": "协作内控",
                "items": [
                  "对账确认",
                  "资料归档",
                  "预算偏差说明"
                ]
              }
            ],
            "_config": {
              "moduleName": "财务技能"
            }
          },
          "sortOrder": 5,
          "layout": "auto"
        },
        {
          "sectionType": "certificates",
          "data": {
            "items": [
              {
                "title": "初级会计专业技术资格（示例）",
                "date": "2023-05",
                "level": "按真实取得情况替换"
              },
              {
                "title": "大学英语六级（示例）",
                "date": "2022-12",
                "level": "可阅读基础商务材料"
              }
            ],
            "_config": {
              "moduleName": "专业资格"
            }
          },
          "sortOrder": 6,
          "layout": "auto"
        }
      ]
    }
  },
  {
    "key": "hr-specialist",
    "name": "人力资源·招聘协同",
    "description": "人力资源专员原创范文，适用于1–3 年。招聘漏斗、入职服务、流程执行；含可编辑完整经历与项目，示例内容请替换为真实经历。",
    "category": "business",
    "tags": [
      "人力资源专员",
      "1–3 年",
      "单栏",
      "招聘漏斗",
      "入职服务"
    ],
    "sortOrder": 19,
    "legacyNames": [],
    "config": {
      "systemKey": "hr-specialist",
      "layout": "single-column",
      "fonts": [
        "Noto Sans SC",
        "Microsoft YaHei",
        "system-ui"
      ],
      "primaryColor": "#7e22ce",
      "accentColor": "#7e22ce12",
      "headerStyle": "underline",
      "sections": [
        "basic",
        "summary",
        "experience",
        "projects",
        "education",
        "skills",
        "custom"
      ],
      "globalFontSize": 13,
      "globalLineSpacing": 1.55,
      "pageTopMargin": 36,
      "pageBottomMargin": 36,
      "pageLeftMargin": 38,
      "pageRightMargin": 38,
      "moduleMargin": 14,
      "titleTopPadding": 4,
      "titleBottomMargin": 7
    },
    "sample": {
      "version": 1,
      "profile": {
        "key": "hr-specialist",
        "jobTitle": "人力资源专员",
        "experienceLevel": "1–3 年",
        "highlights": [
          "招聘漏斗",
          "入职服务",
          "流程执行"
        ],
        "suggestedPages": 1
      },
      "sections": [
        {
          "sectionType": "basic",
          "data": {
            "name": "叶书宁",
            "jobTitle": "人力资源专员",
            "city": "南京",
            "phone": "138****1019",
            "email": "shuning.ye@example.com",
            "links": [],
            "_config": {
              "moduleName": "基本信息"
            }
          },
          "sortOrder": 0,
          "layout": "auto"
        },
        {
          "sectionType": "summary",
          "data": {
            "content": "2024 年起从事人力资源运营，协助招聘、入职和员工服务。能够依据岗位需求维护招聘流程，准确记录候选人状态与沟通约定，按制度处理资料和交接；关注候选人体验与内部响应，使用漏斗和服务记录发现流程阻塞，审慎保护个人资料与访问范围。",
            "_config": {
              "moduleName": "职业概述"
            }
          },
          "sortOrder": 1,
          "layout": "auto"
        },
        {
          "sectionType": "experience",
          "data": {
            "items": [
              {
                "company": "澄星企业服务（虚构）",
                "position": "人力资源专员",
                "startDate": "2024-07",
                "endDate": "",
                "current": true,
                "bullets": [
                  "支持销售、客服及运营岗位招聘，与用人经理确认职责、工作地点和筛选条件，维护候选人沟通及面试排期台账。",
                  "每周整理简历筛选、面试、录用与到岗漏斗，区分渠道来源和岗位差异，对集中流失环节回访并提出流程改进建议。",
                  "协助员工入职、试用期提醒和常见政策咨询，核对资料及责任人，对薪资、劳动关系等专业问题按流程交由负责人处理。"
                ]
              }
            ],
            "_config": {
              "moduleName": "人力资源经历"
            }
          },
          "sortOrder": 2,
          "layout": "auto"
        },
        {
          "sectionType": "projects",
          "data": {
            "items": [
              {
                "name": "面试排期与反馈流程整理",
                "role": "流程执行与数据跟踪",
                "startDate": "2025-01",
                "endDate": "2025-05",
                "current": false,
                "tech": "漏斗台账 · 沟通模板 · 时间记录",
                "bullets": [
                  "复盘 65 场面试的邀请与反馈记录，发现临时改期和反馈滞后问题，与用人经理约定可预约时段及反馈截止时间。",
                  "设计邀请、改期和结果通知模板，保留候选人偏好及确认状态；对超期反馈设置提醒，并记录原因供周会讨论。",
                  "两轮执行后，面试后两日内完成内部反馈的比例由 61% 升至 84%，同时记录样本、岗位差异和未能按期处理的原因。"
                ]
              },
              {
                "name": "新员工首月服务清单",
                "role": "资料与交接协调",
                "startDate": "2025-08",
                "endDate": "2025-11",
                "current": false,
                "tech": "入职节点 · 跨部门交接 · 回访",
                "bullets": [
                  "访谈 12 名近期入职员工，将账号开通、设备领取和培训安排列为首周重点，确认行政、IT 与直属经理的分工。",
                  "按入职前、首日和首月整理检查清单，只向对应角色提供必要信息；缺失事项明确责任人与预计完成时间。",
                  "在 18 名新员工中试行，收集首周与首月反馈，调整培训入口和联系人说明，形成后续批次可复用的服务指引。"
                ]
              }
            ],
            "_config": {
              "moduleName": "流程项目"
            }
          },
          "sortOrder": 3,
          "layout": "auto"
        },
        {
          "sectionType": "education",
          "data": {
            "items": [
              {
                "school": "江城管理学院（虚构）",
                "major": "人力资源管理",
                "degree": "本科",
                "startDate": "2020-09",
                "endDate": "2024-06",
                "current": false,
                "description": "相关课程：组织行为、招聘管理、薪酬管理、劳动关系与统计学。毕业实践研究校招候选人沟通体验，完成访谈、编码与流程建议。"
              }
            ],
            "_config": {
              "moduleName": "教育背景"
            }
          },
          "sortOrder": 4,
          "layout": "auto"
        },
        {
          "sectionType": "skills",
          "data": {
            "items": [
              {
                "name": "招聘协作",
                "items": [
                  "需求澄清",
                  "面试排期",
                  "候选人沟通"
                ]
              },
              {
                "name": "员工服务",
                "items": [
                  "入职资料检查",
                  "节点提醒",
                  "制度咨询分流"
                ]
              },
              {
                "name": "数据文档",
                "items": [
                  "Excel 漏斗台账",
                  "流程模板",
                  "权限与资料归档"
                ]
              }
            ],
            "_config": {
              "moduleName": "专业技能"
            }
          },
          "sortOrder": 5,
          "layout": "auto"
        },
        {
          "sectionType": "custom",
          "data": {
            "content": "候选人与员工记录区分已确认事实、待核验信息和处理意见，减少主观评价。每项服务保留受理时间、责任人与反馈时点，跨部门转交后继续确认是否解决。定期清理重复或过期资料，按公司规定限制文件访问和保存期限，使业务协作与个人信息管理都有清晰依据。",
            "_config": {
              "moduleName": "服务记录习惯"
            }
          },
          "sortOrder": 6,
          "layout": "auto"
        }
      ]
    }
  },
  {
    "key": "sales-business",
    "name": "销售商务·客户经营",
    "description": "企业客户销售原创范文，适用于3–5 年。需求与方案、商机推进、客户续约；含可编辑完整经历与项目，示例内容请替换为真实经历。",
    "category": "business",
    "tags": [
      "企业客户销售",
      "3–5 年",
      "单栏",
      "需求与方案",
      "商机推进"
    ],
    "sortOrder": 20,
    "legacyNames": [],
    "config": {
      "systemKey": "sales-business",
      "layout": "single-column",
      "fonts": [
        "Noto Sans SC",
        "Microsoft YaHei",
        "system-ui"
      ],
      "primaryColor": "#92400e",
      "accentColor": "#92400e12",
      "headerStyle": "underline",
      "sections": [
        "basic",
        "summary",
        "experience",
        "projects",
        "education",
        "skills",
        "custom"
      ],
      "globalFontSize": 13,
      "globalLineSpacing": 1.55,
      "pageTopMargin": 36,
      "pageBottomMargin": 36,
      "pageLeftMargin": 38,
      "pageRightMargin": 38,
      "moduleMargin": 14,
      "titleTopPadding": 4,
      "titleBottomMargin": 7
    },
    "sample": {
      "version": 1,
      "profile": {
        "key": "sales-business",
        "jobTitle": "企业客户销售",
        "experienceLevel": "3–5 年",
        "highlights": [
          "需求与方案",
          "商机推进",
          "客户续约"
        ],
        "suggestedPages": 1
      },
      "sections": [
        {
          "sectionType": "basic",
          "data": {
            "name": "韩予程",
            "jobTitle": "企业客户销售",
            "city": "上海",
            "phone": "138****1020",
            "email": "yucheng.han@example.com",
            "links": [],
            "_config": {
              "moduleName": "基本信息"
            }
          },
          "sortOrder": 0,
          "layout": "auto"
        },
        {
          "sectionType": "summary",
          "data": {
            "content": "2022 年起从事企业软件销售，服务中小制造与企业服务客户，经历线索沟通、方案演示、合同及续约协作。能够识别业务需求、决策角色和采购节奏，协调售前与实施资源，将商机推进过程记录到客户台账，关注承诺可交付、回款和长期使用情况。",
            "_config": {
              "moduleName": "职业概述"
            }
          },
          "sortOrder": 1,
          "layout": "auto"
        },
        {
          "sectionType": "experience",
          "data": {
            "items": [
              {
                "company": "远景协同软件（虚构）",
                "position": "企业客户经理",
                "startDate": "2023-10",
                "endDate": "",
                "current": true,
                "bullets": [
                  "经营 23 家存量客户并跟进新商机，按使用场景、预算和决策角色维护机会，避免将未确认需求直接计为销售预测。",
                  "与售前共同准备演示和试用方案，明确客户验收问题及实施依赖，2025 年完成 9 份新签合同，合同金额合计 186 万元。",
                  "按合同节点跟踪回款与上线，季度回访使用阻碍，将需研发或服务支持的事项转交负责人；当年到期 12 家客户中续约 10 家。"
                ]
              },
              {
                "company": "星原办公服务（虚构）",
                "position": "商务拓展专员",
                "startDate": "2022-07",
                "endDate": "2023-09",
                "current": false,
                "bullets": [
                  "通过行业活动与客户推荐建立线索，完成首次沟通、需求记录和跟进安排，向负责人说明下一步动作与预计时间。",
                  "协助整理报价、招采材料和合同版本，核对服务范围、付款与交付条件，涉及变更时及时申请内部确认。",
                  "维护客户问题与竞品反馈清单，将价格异议拆为范围、实施和长期成本，帮助销售团队完善方案说明与常见问答。"
                ]
              }
            ],
            "_config": {
              "moduleName": "销售经历"
            }
          },
          "sortOrder": 2,
          "layout": "auto"
        },
        {
          "sectionType": "projects",
          "data": {
            "items": [
              {
                "name": "制造客户协同系统采购推进",
                "role": "商机与商务协调",
                "startDate": "2024-11",
                "endDate": "2025-06",
                "current": false,
                "tech": "需求访谈 · 试用验证 · 合同协调",
                "bullets": [
                  "访谈生产、采购和财务 6 位相关人员，将需求整理为协同排程、权限和报表三类，确认各角色的判断标准。",
                  "协调售前设计两周试用与问题清单，对客户提出的接口要求先核实现有能力，再讨论分期实施与费用范围。",
                  "推进合同、实施交接及首期验收，记录销售承诺和待完成事项；项目签约金额 32 万元，后续服务由实施团队共同交付。"
                ]
              }
            ],
            "_config": {
              "moduleName": "客户项目"
            }
          },
          "sortOrder": 3,
          "layout": "auto"
        },
        {
          "sectionType": "education",
          "data": {
            "items": [
              {
                "school": "海川工商学院（虚构）",
                "major": "工商管理",
                "degree": "本科",
                "startDate": "2018-09",
                "endDate": "2022-06",
                "current": false,
                "description": "学习市场营销、商务谈判、财务管理与运营管理。课程项目完成企业采购流程访谈，训练需求分析、方案比较和商务表达。"
              }
            ],
            "_config": {
              "moduleName": "教育背景"
            }
          },
          "sortOrder": 4,
          "layout": "auto"
        },
        {
          "sectionType": "skills",
          "data": {
            "items": [
              {
                "name": "机会管理",
                "items": [
                  "需求与决策角色",
                  "采购节奏",
                  "销售预测口径"
                ]
              },
              {
                "name": "方案商务",
                "items": [
                  "场景演示协作",
                  "报价与合同核对",
                  "异议澄清"
                ]
              },
              {
                "name": "客户维护",
                "items": [
                  "CRM 记录",
                  "回款节点",
                  "续约与服务交接"
                ]
              }
            ],
            "_config": {
              "moduleName": "客户经营技能"
            }
          },
          "sortOrder": 5,
          "layout": "auto"
        },
        {
          "sectionType": "custom",
          "data": {
            "content": "每次客户会议形成需求、已确认事项、待确认风险与下一步计划，明确双方负责人。报价前核对交付边界，试用后保留验收问题和使用反馈，合同交接时同步完整承诺清单。复盘失单时区分需求不匹配、采购推迟和竞品因素，为下一轮方案准备提供具体材料。",
            "_config": {
              "moduleName": "客户协作方式"
            }
          },
          "sortOrder": 6,
          "layout": "auto"
        }
      ]
    }
  },
  {
    "key": "supply-chain",
    "name": "供应链采购·交付成本",
    "description": "采购与供应链专员原创范文，适用于3–5 年。供应商协作、交期跟踪、库存与成本；含可编辑完整经历与项目，示例内容请替换为真实经历。",
    "category": "business",
    "tags": [
      "采购与供应链专员",
      "3–5 年",
      "单栏",
      "供应商协作",
      "交期跟踪"
    ],
    "sortOrder": 21,
    "legacyNames": [],
    "config": {
      "systemKey": "supply-chain",
      "layout": "single-column",
      "fonts": [
        "Noto Sans SC",
        "Microsoft YaHei",
        "system-ui"
      ],
      "primaryColor": "#047857",
      "accentColor": "#04785712",
      "headerStyle": "underline",
      "sections": [
        "basic",
        "summary",
        "experience",
        "projects",
        "education",
        "skills",
        "custom"
      ],
      "globalFontSize": 13,
      "globalLineSpacing": 1.55,
      "pageTopMargin": 36,
      "pageBottomMargin": 36,
      "pageLeftMargin": 38,
      "pageRightMargin": 38,
      "moduleMargin": 14,
      "titleTopPadding": 4,
      "titleBottomMargin": 7
    },
    "sample": {
      "version": 1,
      "profile": {
        "key": "supply-chain",
        "jobTitle": "采购与供应链专员",
        "experienceLevel": "3–5 年",
        "highlights": [
          "供应商协作",
          "交期跟踪",
          "库存与成本"
        ],
        "suggestedPages": 1
      },
      "sections": [
        {
          "sectionType": "basic",
          "data": {
            "name": "温序宁",
            "jobTitle": "采购与供应链专员",
            "city": "苏州",
            "phone": "138****1021",
            "email": "xuning.wen@example.com",
            "links": [],
            "_config": {
              "moduleName": "基本信息"
            }
          },
          "sortOrder": 0,
          "layout": "auto"
        },
        {
          "sectionType": "summary",
          "data": {
            "content": "2022 年起从事制造企业采购与供应协调，负责电子辅料和包装物料的询比价、订单跟踪与异常处理。能够结合生产计划、库存和供应商能力安排交付，关注总成本、质量与交期的平衡；维护准确记录，及时把风险转为可讨论的替代方案和责任安排。",
            "_config": {
              "moduleName": "职业概述"
            }
          },
          "sortOrder": 1,
          "layout": "auto"
        },
        {
          "sectionType": "experience",
          "data": {
            "items": [
              {
                "company": "青岳智能制造（虚构）",
                "position": "采购专员",
                "startDate": "2023-09",
                "endDate": "",
                "current": true,
                "bullets": [
                  "负责 32 类电子辅料与包装物料，维护 16 家常用供应商的价格、交期和最小起订量，按生产计划下单并跟踪确认。",
                  "与计划及仓库每周核对在途、可用库存和需求变动，对缺料风险明确最晚到货日，协调分批交货或经确认的替代方案。",
                  "月度汇总供应商准时交付、到货差异和质量反馈，和质量部门复核原因，把整改时点与复查结果纳入供应商沟通记录。"
                ]
              },
              {
                "company": "明川工业配套（虚构）",
                "position": "供应链助理",
                "startDate": "2022-07",
                "endDate": "2023-08",
                "current": false,
                "bullets": [
                  "维护采购订单、收货和发票关联表，对数量及价格差异逐项核实，协助财务与供应商完成月度对账。",
                  "整理历史消耗、库存账龄和滞料原因，按停用、设计变更与超量采购分类，供计划负责人安排消耗或处置。",
                  "协助收集新供应商资质与样品资料，按评审清单核对缺失项，跟进试用记录，不以报价最低替代综合准入判断。"
                ]
              }
            ],
            "_config": {
              "moduleName": "工作经历"
            }
          },
          "sortOrder": 2,
          "layout": "auto"
        },
        {
          "sectionType": "projects",
          "data": {
            "items": [
              {
                "name": "包装物料交期与库存优化",
                "role": "数据整理与供应协调",
                "startDate": "2024-08",
                "endDate": "2025-02",
                "current": false,
                "tech": "需求分层 · 交付排期 · 成本比较",
                "bullets": [
                  "复盘 6 个月包装需求，将常规、活动和定制物料分开，发现低频定制集中下单造成积压，与业务确认需求冻结点。",
                  "和两家供应商比较分批交付、起订量与运输成本，选取 8 类常用物料试行滚动计划，保留紧急需求的审批入口。",
                  "连续三个月跟踪试点，平均库存覆盖天数由 47 天降至 35 天，准时到货保持在约 95%；记录试点范围和季节性影响。"
                ]
              }
            ],
            "_config": {
              "moduleName": "供应链项目"
            }
          },
          "sortOrder": 3,
          "layout": "auto"
        },
        {
          "sectionType": "education",
          "data": {
            "items": [
              {
                "school": "东江物流学院（虚构）",
                "major": "物流管理",
                "degree": "本科",
                "startDate": "2018-09",
                "endDate": "2022-06",
                "current": false,
                "description": "相关课程：采购管理、库存控制、供应链管理与运筹学。毕业设计使用模拟需求比较补货策略，讨论服务水平、起订量与资金占用。"
              }
            ],
            "_config": {
              "moduleName": "教育背景"
            }
          },
          "sortOrder": 4,
          "layout": "auto"
        },
        {
          "sectionType": "skills",
          "data": {
            "items": [
              {
                "name": "采购执行",
                "items": [
                  "询比价与合同",
                  "订单确认",
                  "供应商台账"
                ]
              },
              {
                "name": "计划协同",
                "items": [
                  "缺料风险跟踪",
                  "库存覆盖分析",
                  "分批交付"
                ]
              },
              {
                "name": "数据质量",
                "items": [
                  "Excel 透视与核对",
                  "ERP 单据关联",
                  "总成本比较"
                ]
              }
            ],
            "_config": {
              "moduleName": "专业技能"
            }
          },
          "sortOrder": 5,
          "layout": "auto"
        },
        {
          "sectionType": "custom",
          "data": {
            "content": "交期异常先核对需求变化、供应承诺和运输节点，再说明影响工单及最晚处理时点。所有替代物料与临时采购均保留内部确认，避免口头变更造成质量和结算争议。季度复盘将质量、交付和价格一起讨论，对单一来源物料记录备选进度、验证条件及未解决风险。",
            "_config": {
              "moduleName": "风险与交接记录"
            }
          },
          "sortOrder": 6,
          "layout": "auto"
        }
      ]
    }
  },
  {
    "key": "graduate-business",
    "name": "商科校招·实习实践",
    "description": "市场/商业分析实习生原创范文，适用于应届/实习。两段实习、研究实践、校园组织；含可编辑完整经历与项目，示例内容请替换为真实经历。",
    "category": "graduate",
    "tags": [
      "市场/商业分析实习生",
      "应届/实习",
      "单栏",
      "两段实习",
      "研究实践"
    ],
    "sortOrder": 22,
    "legacyNames": [],
    "config": {
      "systemKey": "graduate-business",
      "layout": "single-column",
      "fonts": [
        "Noto Sans SC",
        "Microsoft YaHei",
        "system-ui"
      ],
      "primaryColor": "#0369a1",
      "accentColor": "#0369a112",
      "headerStyle": "underline",
      "sections": [
        "basic",
        "education",
        "summary",
        "experience",
        "projects",
        "custom",
        "skills",
        "awards"
      ],
      "globalFontSize": 13,
      "globalLineSpacing": 1.55,
      "pageTopMargin": 36,
      "pageBottomMargin": 36,
      "pageLeftMargin": 38,
      "pageRightMargin": 38,
      "moduleMargin": 14,
      "titleTopPadding": 4,
      "titleBottomMargin": 7
    },
    "sample": {
      "version": 1,
      "profile": {
        "key": "graduate-business",
        "jobTitle": "市场/商业分析实习生",
        "experienceLevel": "应届/实习",
        "highlights": [
          "两段实习",
          "研究实践",
          "校园组织"
        ],
        "suggestedPages": 1
      },
      "sections": [
        {
          "sectionType": "basic",
          "data": {
            "name": "陈予宁",
            "jobTitle": "市场/商业分析实习生",
            "city": "上海",
            "phone": "138****1022",
            "email": "yuning.chen@example.com",
            "links": [],
            "_config": {
              "moduleName": "基本信息"
            }
          },
          "sortOrder": 0,
          "layout": "auto"
        },
        {
          "sectionType": "education",
          "data": {
            "items": [
              {
                "school": "海川财经学院（虚构）",
                "major": "市场营销",
                "degree": "本科",
                "startDate": "2022-09",
                "endDate": "2026-06",
                "current": false,
                "description": "GPA 3.6/4.0（示例）。课程包括市场研究、统计学、消费者行为、会计学原理与商业数据分析；课程成绩与排名请按实际情况替换。"
              }
            ],
            "_config": {
              "moduleName": "教育背景"
            }
          },
          "sortOrder": 1,
          "layout": "auto"
        },
        {
          "sectionType": "summary",
          "data": {
            "content": "2026 届市场营销专业毕业生，完成市场研究与运营两段实习，参与访谈、问卷、竞品整理和活动支持。能够使用 Excel 和基础 SQL 处理资料，清楚表达研究范围与个人贡献，希望在市场研究或商业分析岗位继续学习业务判断和规范分析方法。",
            "_config": {
              "moduleName": "求职概述"
            }
          },
          "sortOrder": 2,
          "layout": "auto"
        },
        {
          "sectionType": "experience",
          "data": {
            "items": [
              {
                "company": "青禾消费品牌（虚构）",
                "position": "市场研究实习生",
                "startDate": "2025-07",
                "endDate": "2025-10",
                "current": false,
                "bullets": [
                  "在主管指导下整理 15 次访谈和 210 份有效问卷，将购买动机、使用场景及顾虑归纳为 4 类需求，保留原始记录对应关系。",
                  "统一 6 个竞品的规格、售价与渠道信息，用 Excel 透视表形成周度比较，标注采集日期、促销与规格口径。",
                  "将材料整理为 18 页汇报，3 条建议进入新品卖点测试；本人负责资料和分析，不将团队决策写为个人独立成果。"
                ]
              },
              {
                "company": "明衡企业服务（虚构）",
                "position": "运营实习生",
                "startDate": "2025-01",
                "endDate": "2025-03",
                "current": false,
                "bullets": [
                  "维护客户试用与跟进表，整理 120 条反馈，按功能、操作和服务问题分类，交给对应负责人并记录后续处理。",
                  "针对重复咨询梳理 12 个常见问题，更新引导文档，通过前后两周咨询记录观察使用情况，支持客服调整答复。",
                  "协助 4 场客户交流活动的报名页面、到场名单和反馈汇总，核对人数及资料版本，按时交付活动复盘材料。"
                ]
              }
            ],
            "_config": {
              "moduleName": "实习经历"
            }
          },
          "sortOrder": 3,
          "layout": "auto"
        },
        {
          "sectionType": "projects",
          "data": {
            "items": [
              {
                "name": "校园便利店消费行为研究",
                "role": "4 人小组/数据整理与分析",
                "startDate": "2024-10",
                "endDate": "2024-12",
                "current": false,
                "tech": "问卷设计 · 交叉表 · 方案比较",
                "bullets": [
                  "将高峰期排队流失拆为到店时段、购买任务和等待容忍度，参与研究问题与问卷设计，先用小样本试填修正歧义。",
                  "清洗 186 份有效问卷，以交叉表比较购买频率与时段关系；记录抽样范围，说明结果不能直接推广到所有校区。",
                  "提出快取区与预包装组合建议，按成本、执行难度和观察指标比较，完成课堂答辩并整理老师对样本局限的反馈。"
                ]
              }
            ],
            "_config": {
              "moduleName": "研究与实践项目"
            }
          },
          "sortOrder": 4,
          "layout": "auto"
        },
        {
          "sectionType": "custom",
          "data": {
            "content": "海川财经学院学生发展中心（虚构）｜活动组负责人｜2024.09–2025.06。协调 8 名志愿者完成 3 场职业分享活动，负责场地、流程、讲者资料与现场交接，累计服务约 260 人次。根据活动后问卷改善签到和提问环节，复盘时保留未到场原因与建议，供下一届组织者参考。",
            "_config": {
              "moduleName": "校园经历"
            }
          },
          "sortOrder": 5,
          "layout": "auto"
        },
        {
          "sectionType": "skills",
          "data": {
            "items": [
              {
                "name": "资料分析",
                "items": [
                  "Excel 常用函数与透视表",
                  "基础 SQL",
                  "问卷清洗"
                ]
              },
              {
                "name": "研究表达",
                "items": [
                  "访谈纪要",
                  "竞品资料核验",
                  "PowerPoint 汇报"
                ]
              },
              {
                "name": "语言协作",
                "items": [
                  "英文行业材料阅读",
                  "中文摘要",
                  "活动流程与分工"
                ]
              }
            ],
            "_config": {
              "moduleName": "技能与语言"
            }
          },
          "sortOrder": 6,
          "layout": "auto"
        },
        {
          "sectionType": "awards",
          "data": {
            "items": [
              {
                "title": "校级综合奖学金（示例）",
                "date": "2024-11",
                "level": "按真实情况替换"
              },
              {
                "title": "校园商业案例分析赛二等奖（示例）",
                "date": "2025-05",
                "level": "小组成员/数据分析"
              }
            ],
            "_config": {
              "moduleName": "奖项"
            }
          },
          "sortOrder": 7,
          "layout": "auto"
        }
      ]
    }
  },
  {
    "key": "graduate-general",
    "name": "通用校招·校园成长",
    "description": "综合事务/运营助理（应届）原创范文，适用于应届/实习。课程实践、志愿服务、组织协作；含可编辑完整经历与项目，示例内容请替换为真实经历。",
    "category": "graduate",
    "tags": [
      "综合事务/运营助理（应届）",
      "应届/实习",
      "单栏",
      "课程实践",
      "志愿服务"
    ],
    "sortOrder": 23,
    "legacyNames": [],
    "config": {
      "systemKey": "graduate-general",
      "layout": "single-column",
      "fonts": [
        "Noto Sans SC",
        "Microsoft YaHei",
        "system-ui"
      ],
      "primaryColor": "#0891b2",
      "accentColor": "#0891b212",
      "headerStyle": "underline",
      "sections": [
        "basic",
        "education",
        "summary",
        "experience",
        "projects",
        "custom",
        "skills",
        "awards"
      ],
      "globalFontSize": 13,
      "globalLineSpacing": 1.55,
      "pageTopMargin": 36,
      "pageBottomMargin": 36,
      "pageLeftMargin": 38,
      "pageRightMargin": 38,
      "moduleMargin": 14,
      "titleTopPadding": 4,
      "titleBottomMargin": 7
    },
    "sample": {
      "version": 1,
      "profile": {
        "key": "graduate-general",
        "jobTitle": "综合事务/运营助理（应届）",
        "experienceLevel": "应届/实习",
        "highlights": [
          "课程实践",
          "志愿服务",
          "组织协作"
        ],
        "suggestedPages": 1
      },
      "sections": [
        {
          "sectionType": "basic",
          "data": {
            "name": "江予晴",
            "jobTitle": "综合事务/运营助理（应届）",
            "city": "武汉",
            "phone": "138****1023",
            "email": "yuqing.jiang@example.com",
            "links": [],
            "_config": {
              "moduleName": "基本信息"
            }
          },
          "sortOrder": 0,
          "layout": "auto"
        },
        {
          "sectionType": "education",
          "data": {
            "items": [
              {
                "school": "江城文理学院（虚构）",
                "major": "公共事业管理",
                "degree": "本科",
                "startDate": "2022-09",
                "endDate": "2026-06",
                "current": false,
                "description": "课程包括管理学、社会调查、应用统计、公共关系与文书写作。GPA 3.4/4.0（示例）；毕业实践围绕社区活动组织与参与反馈完成调研报告。"
              }
            ],
            "_config": {
              "moduleName": "教育背景"
            }
          },
          "sortOrder": 1,
          "layout": "auto"
        },
        {
          "sectionType": "summary",
          "data": {
            "content": "2026 届公共事业管理专业毕业生，完成一段综合事务实习，参与校园服务调研与志愿活动。能够整理报名、排期和反馈资料，使用办公工具维护清单，及时确认责任和截止时间。希望从事务执行与运营支持岗位开始，把细致记录、沟通跟进和持续复盘落实到日常工作。",
            "_config": {
              "moduleName": "求职概述"
            }
          },
          "sortOrder": 2,
          "layout": "auto"
        },
        {
          "sectionType": "experience",
          "data": {
            "items": [
              {
                "company": "知桥社区服务中心（虚构）",
                "position": "综合事务实习生",
                "startDate": "2025-07",
                "endDate": "2025-09",
                "current": false,
                "bullets": [
                  "协助 5 场社区活动的报名、物料和现场签到，依据流程表逐项检查场地、人员与安全提示，及时向负责人报告缺项。",
                  "整理约 160 条参与反馈，按活动内容、时间与现场服务分类，保留原始表述，汇总可由执行环节改进的问题。",
                  "维护物料借还和志愿者排班记录，活动后核对数量及未归还原因，将确认信息交接给值班同事，减少重复联系。"
                ]
              }
            ],
            "_config": {
              "moduleName": "实习经历"
            }
          },
          "sortOrder": 3,
          "layout": "auto"
        },
        {
          "sectionType": "projects",
          "data": {
            "items": [
              {
                "name": "校园办事信息可读性调研",
                "role": "4 人小组/访谈与整理",
                "startDate": "2024-10",
                "endDate": "2024-12",
                "current": false,
                "tech": "访谈 · 信息归类 · 文档原型",
                "bullets": [
                  "围绕新生查找办事入口的困难，访谈 18 位同学并记录具体任务，区分找不到信息、看不懂材料与流程变化三类问题。",
                  "核对 8 类常见事项的公开办理说明，用标题、材料和下一步动作重排信息，请老师与同学共同检查表述是否准确。",
                  "邀请 10 位同学使用新旧文档完成同一任务，记录成功率和疑问；将原型、反馈与样本限制写入课程报告。"
                ]
              },
              {
                "name": "社区阅读日组织实践",
                "role": "现场与反馈协调",
                "startDate": "2025-03",
                "endDate": "2025-05",
                "current": false,
                "tech": "任务清单 · 分工 · 服务记录",
                "bullets": [
                  "和 6 名同学共同筹备 2 场阅读活动，负责参与登记、场地检查与时间提醒，把每项任务落实到具体负责人。",
                  "根据首次活动中的签到拥堵调整入口和名单顺序，提前给志愿者演示流程，保留临时缺席时的替补安排。",
                  "两场累计服务 94 人次，整理问卷、物料消耗和现场记录，提出缩短开场说明及设置休息区的建议供下次参考。"
                ]
              }
            ],
            "_config": {
              "moduleName": "课程实践"
            }
          },
          "sortOrder": 4,
          "layout": "auto"
        },
        {
          "sectionType": "custom",
          "data": {
            "content": "江城文理学院志愿服务队（虚构）｜项目组成员｜2023.10–2025.06。参与图书整理、迎新指引与社区阅读活动，按分工完成报名核对、场地引导和材料归档。服务结束后记录常见问题及交接事项，保持出勤、反馈和物资记录一致，帮助后续同学快速了解活动要求。",
            "_config": {
              "moduleName": "校园与志愿服务"
            }
          },
          "sortOrder": 5,
          "layout": "auto"
        },
        {
          "sectionType": "skills",
          "data": {
            "items": [
              {
                "name": "办公整理",
                "items": [
                  "Excel 表格与筛选",
                  "Word 规范排版",
                  "演示文稿"
                ]
              },
              {
                "name": "执行协作",
                "items": [
                  "活动流程清单",
                  "排班与物料",
                  "会议纪要"
                ]
              },
              {
                "name": "调研沟通",
                "items": [
                  "访谈记录",
                  "问卷分类",
                  "服务反馈跟进"
                ]
              }
            ],
            "_config": {
              "moduleName": "实用技能"
            }
          },
          "sortOrder": 6,
          "layout": "auto"
        },
        {
          "sectionType": "awards",
          "data": {
            "items": [
              {
                "title": "校级优秀志愿者（示例）",
                "date": "2025-06",
                "level": "按真实服务记录替换"
              },
              {
                "title": "社会调查课程优秀小组（示例）",
                "date": "2024-12",
                "level": "负责访谈与资料整理"
              }
            ],
            "_config": {
              "moduleName": "校园荣誉"
            }
          },
          "sortOrder": 7,
          "layout": "auto"
        }
      ]
    }
  },
  {
    "key": "registered-nurse",
    "name": "护理求职·临床实践",
    "description": "临床护士原创范文，适用于应届/1–3 年。护理资格、临床轮转、患者沟通；含可编辑完整经历与项目，示例内容请替换为真实经历。",
    "category": "medical",
    "tags": [
      "临床护士",
      "应届/1–3 年",
      "侧栏",
      "护理资格",
      "临床轮转"
    ],
    "sortOrder": 24,
    "legacyNames": [],
    "config": {
      "systemKey": "registered-nurse",
      "layout": "sidebar",
      "fonts": [
        "Noto Sans SC",
        "Microsoft YaHei",
        "system-ui"
      ],
      "primaryColor": "#0e7490",
      "accentColor": "#0e749012",
      "headerStyle": "solid",
      "sections": [
        "basic",
        "summary",
        "certificates",
        "experience",
        "projects",
        "education",
        "skills"
      ],
      "globalFontSize": 13,
      "globalLineSpacing": 1.55,
      "pageTopMargin": 36,
      "pageBottomMargin": 36,
      "pageLeftMargin": 38,
      "pageRightMargin": 38,
      "moduleMargin": 14,
      "titleTopPadding": 4,
      "titleBottomMargin": 7
    },
    "sample": {
      "version": 1,
      "profile": {
        "key": "registered-nurse",
        "jobTitle": "临床护士",
        "experienceLevel": "应届/1–3 年",
        "highlights": [
          "护理资格",
          "临床轮转",
          "患者沟通"
        ],
        "suggestedPages": 1
      },
      "sections": [
        {
          "sectionType": "basic",
          "data": {
            "name": "苏予宁",
            "jobTitle": "临床护士",
            "city": "广州",
            "phone": "138****1024",
            "email": "yuning.su@example.com",
            "links": [],
            "_config": {
              "moduleName": "基本信息"
            }
          },
          "sortOrder": 0,
          "layout": "auto"
        },
        {
          "sectionType": "summary",
          "data": {
            "content": "2024 年护理学本科毕业，在综合医院完成临床实践并从事病区护理。能够按制度完成身份核对、护理评估、交接和患者沟通，在带教与科室规范下开展操作；遇到病情变化及时报告，重视记录完整、患者理解与跨班次信息连续，持续通过案例复盘提升判断和协作。",
            "_config": {
              "moduleName": "护理概述"
            }
          },
          "sortOrder": 1,
          "layout": "right"
        },
        {
          "sectionType": "certificates",
          "data": {
            "items": [
              {
                "title": "护士执业资格考试合格（示例）",
                "date": "2024-05",
                "level": "按真实考试结果替换"
              },
              {
                "title": "护士执业注册（示例）",
                "date": "2024-09",
                "level": "实际求职按有效状态填写"
              }
            ],
            "_config": {
              "moduleName": "专业资质"
            }
          },
          "sortOrder": 2,
          "layout": "left"
        },
        {
          "sectionType": "experience",
          "data": {
            "items": [
              {
                "company": "澄江综合医院（虚构）",
                "position": "内科病区护士",
                "startDate": "2024-08",
                "endDate": "",
                "current": true,
                "bullets": [
                  "按科室流程完成入院评估、生命体征观察和护理记录，对风险与异常及时报告责任护士或医生，跟进处理后的观察要求。",
                  "执行身份核对、用药核查和操作前解释，与患者确认理解；对跌倒风险、活动支持和饮食要求进行个体化提醒。",
                  "参与交接班核对，重点说明病情变化、管路及待完成事项，记录接收人与处理时点，减少跨班次信息遗漏。"
                ]
              },
              {
                "company": "南湾教学医院（虚构）",
                "position": "护理实习生",
                "startDate": "2023-07",
                "endDate": "2024-04",
                "current": false,
                "bullets": [
                  "在带教下完成内科、外科、急诊和手术室轮转，按照实习计划记录学习任务、操作观察和阶段反馈。",
                  "协助基础护理与病区秩序维护，操作前遵循查对和手卫生要求，对超出实习权限的事项主动请示，不独立处理。",
                  "参与患者宣教与出院资料准备，用清晰语言介绍已确认的护理安排，遇到疑问及时交由带教或专业人员解答。"
                ]
              }
            ],
            "_config": {
              "moduleName": "护理经历"
            }
          },
          "sortOrder": 3,
          "layout": "right"
        },
        {
          "sectionType": "projects",
          "data": {
            "items": [
              {
                "name": "病区交接重点提示卡",
                "role": "记录整理与试行反馈",
                "startDate": "2025-03",
                "endDate": "2025-06",
                "current": false,
                "tech": "交接核对 · 过程记录 · 团队讨论",
                "bullets": [
                  "在护士长指导下回顾去标识交接记录，整理待观察事项、管路及检查安排的常见遗漏，形成讨论清单。",
                  "与同组护士设计重点提示卡，按患者、风险、待办和确认时间排列，仅辅助现有交接流程，不替代正式护理记录。",
                  "试行四周后抽查 40 份交接记录，重点事项完整记录由 29 份增至 37 份；结合反馈调整字段，并注明仅评价记录过程。"
                ]
              }
            ],
            "_config": {
              "moduleName": "护理改进实践"
            }
          },
          "sortOrder": 4,
          "layout": "right"
        },
        {
          "sectionType": "education",
          "data": {
            "items": [
              {
                "school": "南岭护理学院（虚构）",
                "major": "护理学",
                "degree": "本科",
                "startDate": "2020-09",
                "endDate": "2024-06",
                "current": false,
                "description": "课程包括基础护理、内外科护理、护理伦理、健康评估与护理研究。完成临床实习与技能考核，毕业实践讨论病区健康教育的理解确认方法。"
              }
            ],
            "_config": {
              "moduleName": "教育背景"
            }
          },
          "sortOrder": 5,
          "layout": "right"
        },
        {
          "sectionType": "skills",
          "data": {
            "items": [
              {
                "name": "临床基础",
                "items": [
                  "护理评估与记录",
                  "生命体征观察",
                  "异常报告"
                ]
              },
              {
                "name": "规范执行",
                "items": [
                  "身份与用药查对",
                  "手卫生",
                  "交接班核对"
                ]
              },
              {
                "name": "患者服务",
                "items": [
                  "操作前解释",
                  "理解确认",
                  "出院护理沟通"
                ]
              }
            ],
            "_config": {
              "moduleName": "护理技能"
            }
          },
          "sortOrder": 6,
          "layout": "left"
        }
      ]
    }
  }
]
$catalog_json$::jsonb)
    LOOP
        -- A stable system key or exact legacy name must also match the original system sort number.
        -- Custom templates at sort 100 stay independent even when copied config retains a system key.
        SELECT array_agg(existing.id ORDER BY existing.id) INTO matched_ids
        FROM templates existing
        WHERE (existing.config->>'systemKey' = seed->>'key'
               AND existing.sort_order = (seed->>'sortOrder')::integer)
           OR (
                (seed->>'sortOrder')::integer BETWEEN 1 AND 12
                AND existing.sort_order = (seed->>'sortOrder')::integer
                AND existing.name IN (SELECT jsonb_array_elements_text(seed->'legacyNames'))
                AND NULLIF(existing.config->>'systemKey', '') IS NULL
           );

        IF COALESCE(cardinality(matched_ids), 0) > 1 THEN
            RAISE EXCEPTION 'Ambiguous system template %: candidate IDs %; review duplicates before applying the catalog', seed->>'key', matched_ids;
        END IF;
        target_id := matched_ids[1];
        IF target_id IS NULL THEN
            INSERT INTO templates (name, description, category, tags, sort_order, config, preview_config, is_premium, is_active)
            VALUES (seed->>'name', seed->>'description', seed->>'category',
                ARRAY(SELECT jsonb_array_elements_text(seed->'tags')), (seed->>'sortOrder')::integer,
                seed->'config', seed->'sample', FALSE, TRUE);
        ELSE
            UPDATE templates SET
                name = seed->>'name', description = seed->>'description', category = seed->>'category',
                tags = ARRAY(SELECT jsonb_array_elements_text(seed->'tags')),
                sort_order = (seed->>'sortOrder')::integer, config = seed->'config',
                preview_config = seed->'sample', is_premium = FALSE, is_active = TRUE
            WHERE id = target_id
              AND (name, description, category, tags, sort_order, config, preview_config, is_premium, is_active)
                  IS DISTINCT FROM (seed->>'name', seed->>'description', seed->>'category',
                      ARRAY(SELECT jsonb_array_elements_text(seed->'tags')), (seed->>'sortOrder')::integer,
                      seed->'config', seed->'sample', FALSE, TRUE);
        END IF;
    END LOOP;
END;
$template_catalog$;
COMMIT;
-- END GENERATED TEMPLATE CATALOG
