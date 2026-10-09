-- 将现有系统模板归一到中文求职方向；不改 ID、配置、预览或用户简历。
-- 幂等：仅匹配仍保留旧名称/分类/排序的系统模板，重复执行不会二次改写。
WITH template_category_map(old_name, old_category, sort_order, new_name, new_description, new_category, new_tags) AS (
    VALUES
        ('简约现代', 'modern', 1, '通用简历', '清晰简洁的单栏布局，留白充足，适合多数行业与岗位', 'general', ARRAY['单栏','通用','简洁']::text[]),
        ('经典稳重', 'classic', 2, '商务经典', '传统双栏布局，左侧信息栏、右侧主内容，适合商务与职能岗位', 'business', ARRAY['双栏','商务','稳重']::text[]),
        ('创意新颖', 'creative', 3, '创意设计', '以色彩和层次突出个人风格，适合视觉与创意岗位', 'design', ARRAY['色彩','设计','创意']::text[]),
        ('技术极客', 'technical', 4, '技术研发', '为研发岗位优化，重点呈现技术能力与项目成果', 'technical', ARRAY['研发','技术','项目']::text[]),
        ('学术简约', 'academic', 5, '学术科研', '突出教育背景、研究经历与学术成果，适合科研和教学岗位', 'academic', ARRAY['学术','科研','教育']::text[]),
        ('商务精英', 'business', 6, '商务管理', '深色标题栏与紧凑排版，适合金融、咨询与管理岗位', 'business', ARRAY['商务','金融','管理']::text[]),
        ('产品经理', 'product', 7, '产品运营', '突出产品成果、运营策略与业务指标，适合互联网产品岗位', 'product', ARRAY['产品','运营','指标']::text[]),
        ('UI 设计', 'design', 8, '界面设计', '留白与层次感更强，适合界面、交互与视觉设计岗位', 'design', ARRAY['设计','视觉','作品']::text[]),
        ('应届校招', 'graduate', 9, '应届校招', '面向应届毕业生，突出实习、项目与校园经历', 'graduate', ARRAY['校招','应届','实习']::text[]),
        ('数据分析', 'data', 10, '数据分析', '强调分析方法、工具与业务洞察，适合数据分析岗位', 'technical', ARRAY['数据','分析','指标']::text[]),
        ('教育培训', 'education', 11, '教育教学', '适合教师、教育培训与教学管理岗位', 'academic', ARRAY['教育','教师','教学']::text[]),
        ('医疗健康', 'medical', 12, '医疗健康', '适合医护、医药与健康行业，突出专业资质与工作经历', 'medical', ARRAY['医疗','医护','资质']::text[])
)
UPDATE templates AS template
SET name = mapping.new_name,
    description = mapping.new_description,
    category = mapping.new_category,
    tags = mapping.new_tags
FROM template_category_map AS mapping
WHERE template.name = mapping.old_name
  AND template.category = mapping.old_category
  AND template.sort_order = mapping.sort_order;
