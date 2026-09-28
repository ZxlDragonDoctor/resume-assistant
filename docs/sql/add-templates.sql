-- 增量补充模板（已在库中的环境执行；幂等）
-- 用法: docker exec -i resumeassistant-postgres-1 psql -U resume -d resume_assistant < docs/sql/add-templates.sql

INSERT INTO templates (name, description, category, tags, sort_order, config) VALUES
  ('产品经理', '突出产品成果与业务指标，适合互联网产品岗位', 'product',
   ARRAY['产品','互联网','指标'], 7,
   '{"layout":"single-column","fonts":["Inter","system-ui"],"primaryColor":"#2563eb","accentColor":"#eff6ff","headerStyle":"underline","sections":["basic","summary","projects","experience","education","skills"]}'),
  ('UI 设计', '留白与层次感更强，适合视觉/交互设计岗位', 'design',
   ARRAY['设计','视觉','作品'], 8,
   '{"layout":"single-column","fonts":["Poppins","system-ui"],"primaryColor":"#db2777","accentColor":"#fdf2f8","headerStyle":"pill","sections":["basic","summary","projects","skills","experience","education"]}'),
  ('应届校招', '面向应届生，突出实习、项目与校园经历', 'graduate',
   ARRAY['校招','应届','实习'], 9,
   '{"layout":"single-column","fonts":["Inter","system-ui"],"primaryColor":"#0284c7","accentColor":"#e0f2fe","headerStyle":"underline","sections":["basic","education","projects","experience","skills","awards"]}'),
  ('数据分析', '强调指标、工具与业务洞察，适合数据/BI 岗位', 'data',
   ARRAY['数据','分析','BI'], 10,
   '{"layout":"two-column","fonts":["Inter","system-ui"],"primaryColor":"#0d9488","accentColor":"#ccfbf1","headerStyle":"bar","sections":["basic","summary","skills","projects","experience","education"]}'),
  ('教育培训', '适合教师、教培与教育行业求职', 'education',
   ARRAY['教育','教师','教培'], 11,
   '{"layout":"single-column","fonts":["Georgia","serif"],"primaryColor":"#b45309","accentColor":"#fef3c7","headerStyle":"underline","sections":["basic","summary","experience","education","skills","certificates"]}'),
  ('医疗健康', '适合医护、医药与大健康行业，突出资质与经历', 'medical',
   ARRAY['医疗','医护','资质'], 12,
   '{"layout":"single-column","fonts":["Helvetica","Arial","system-ui"],"primaryColor":"#0369a1","accentColor":"#e0f2fe","headerStyle":"solid","sections":["basic","summary","certificates","experience","education","skills"]}')
ON CONFLICT DO NOTHING;
