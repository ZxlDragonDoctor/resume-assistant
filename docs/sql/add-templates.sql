-- 增量补充模板（已在库中的环境执行；按系统模板排序号幂等）
-- 用法: docker compose exec -T postgres psql -U resume -d resume_assistant < docs/sql/add-templates.sql

WITH new_templates(name, description, category, tags, sort_order, config) AS (
  VALUES
    ('产品运营', '突出产品成果、运营策略与业务指标，适合互联网产品岗位', 'product',
     ARRAY['产品','运营','指标']::text[], 7,
     '{"layout":"single-column","fonts":["Inter","system-ui"],"primaryColor":"#2563eb","accentColor":"#eff6ff","headerStyle":"underline","sections":["basic","summary","projects","experience","education","skills"]}'::jsonb),
    ('界面设计', '留白与层次感更强，适合界面、交互与视觉设计岗位', 'design',
     ARRAY['设计','视觉','作品']::text[], 8,
     '{"layout":"single-column","fonts":["Poppins","system-ui"],"primaryColor":"#db2777","accentColor":"#fdf2f8","headerStyle":"pill","sections":["basic","summary","projects","skills","experience","education"]}'::jsonb),
    ('应届校招', '面向应届毕业生，突出实习、项目与校园经历', 'graduate',
     ARRAY['校招','应届','实习']::text[], 9,
     '{"layout":"single-column","fonts":["Inter","system-ui"],"primaryColor":"#0284c7","accentColor":"#e0f2fe","headerStyle":"underline","sections":["basic","education","projects","experience","skills","awards"]}'::jsonb),
    ('数据分析', '强调分析方法、工具与业务洞察，适合数据分析岗位', 'technical',
     ARRAY['数据','分析','指标']::text[], 10,
     '{"layout":"two-column","fonts":["Inter","system-ui"],"primaryColor":"#0d9488","accentColor":"#ccfbf1","headerStyle":"bar","sections":["basic","summary","skills","projects","experience","education"]}'::jsonb),
    ('教育教学', '适合教师、教育培训与教学管理岗位', 'academic',
     ARRAY['教育','教师','教学']::text[], 11,
     '{"layout":"single-column","fonts":["Georgia","serif"],"primaryColor":"#b45309","accentColor":"#fef3c7","headerStyle":"underline","sections":["basic","summary","experience","education","skills","certificates"]}'::jsonb),
    ('医疗健康', '适合医护、医药与健康行业，突出专业资质与工作经历', 'medical',
     ARRAY['医疗','医护','资质']::text[], 12,
     '{"layout":"single-column","fonts":["Helvetica","Arial","system-ui"],"primaryColor":"#0369a1","accentColor":"#e0f2fe","headerStyle":"solid","sections":["basic","summary","certificates","experience","education","skills"]}'::jsonb)
)
INSERT INTO templates (name, description, category, tags, sort_order, config)
SELECT seed.name, seed.description, seed.category, seed.tags, seed.sort_order, seed.config
FROM new_templates AS seed
WHERE NOT EXISTS (
  SELECT 1 FROM templates AS existing WHERE existing.sort_order = seed.sort_order
);
