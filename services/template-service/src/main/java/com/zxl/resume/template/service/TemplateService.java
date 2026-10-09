package com.zxl.resume.template.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.zxl.resume.template.entity.Template;
import com.zxl.resume.template.repository.TemplateMapper;
import lombok.RequiredArgsConstructor;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TemplateService {

    private final TemplateMapper templateMapper;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;


    /** 用户把当前简历样式保存为自定义模板（JdbcTemplate 显式类型，避免 jsonb 绑定问题） */
    public Template create(String name, String description, String category,
                           java.util.List<String> tags, String config) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("模板名称不能为空");
        }
        String json = (config == null) ? "" : config.trim();
        if (!isJsonObject(json)) {
            json = "{\"layout\":\"single-column\"}";
        }
        UUID id = UUID.randomUUID();
        String normalizedDescription = (description == null || description.isBlank()) ? "我的自定义模板" : description.trim();
        String normalizedCategory = (category == null || category.isBlank())
                ? "custom" : TemplateCategoryCatalog.normalize(category);
        String[] normalizedTags = tags == null ? new String[0] : tags.stream()
                .filter(StringUtils::hasText)
                .map(String::trim)
                .distinct()
                .toArray(String[]::new);
        jdbcTemplate.update(
                "INSERT INTO templates (id, name, description, category, tags, config, preview_config, is_premium, is_active, sort_order) "
                        + "VALUES (?::uuid, ?::varchar, ?::text, ?::varchar, ?::text[], ?::jsonb, '{}'::jsonb, false, true, 100)",
                id.toString(),
                name.trim(),
                normalizedDescription,
                normalizedCategory,
                normalizedTags,
                json
        );
        Template out = new Template();
        out.setId(id.toString());
        out.setName(name.trim());
        out.setDescription(normalizedDescription);
        out.setCategory(normalizedCategory);
        out.setTags(java.util.Arrays.asList(normalizedTags));
        out.setConfig(json);
        out.setIsActive(true);
        out.setIsPremium(false);
        out.setSortOrder(100);
        return out;
    }

    private boolean isJsonObject(String value) {
        if (!StringUtils.hasText(value)) {
            return false;
        }
        try {
            JsonNode node = objectMapper.readTree(value);
            return node != null && node.isObject();
        } catch (Exception ignored) {
            return false;
        }
    }

    /** 按分类筛选模板；category 为空时返回全部启用中的模板 */
    public List<Template> list(String category, String keyword) {
        LambdaQueryWrapper<Template> q = new LambdaQueryWrapper<Template>()
                .ne(Template::getIsActive, false)
                .orderByAsc(Template::getSortOrder);
        if (StringUtils.hasText(category) && !"all".equalsIgnoreCase(category)) {
            String normalizedCategory = TemplateCategoryCatalog.normalize(category);
            if ("other".equals(normalizedCategory)) {
                List<String> knownCategories = TemplateCategoryCatalog.order().stream()
                        .filter(key -> !"other".equals(key))
                        .flatMap(key -> TemplateCategoryCatalog.aliases(key).stream())
                        .distinct()
                        .toList();
                q.and(w -> w.isNull(Template::getCategory).or().notIn(Template::getCategory, knownCategories));
            } else {
                q.in(Template::getCategory, TemplateCategoryCatalog.aliases(normalizedCategory));
            }
        }
        if (StringUtils.hasText(keyword)) {
            q.and(w -> w.like(Template::getName, keyword).or().like(Template::getDescription, keyword));
        }
        List<Template> templates = templateMapper.selectTemplateList(q);
        templates.forEach(template -> template.setCategory(TemplateCategoryCatalog.normalize(template.getCategory())));
        return templates;
    }

    public Template getById(UUID id) {
        Template template = templateMapper.selectTemplateById(id.toString());
        if (template == null) {
            throw new IllegalArgumentException("模板不存在");
        }
        template.setCategory(TemplateCategoryCatalog.normalize(template.getCategory()));
        return template;
    }

    /** 分类列表 + 每个分类的模板数量，用于模板库的筛选侧栏 */
    public List<Map<String, Object>> categories() {
        List<Template> all = list(null, null);
        Map<String, Long> counts = new LinkedHashMap<>();
        all.forEach(template -> counts.merge(TemplateCategoryCatalog.normalize(template.getCategory()), 1L, Long::sum));
        return TemplateCategoryCatalog.order().stream().map(key -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("key", key);
            m.put("label", TemplateCategoryCatalog.label(key));
            m.put("count", counts.getOrDefault(key, 0L));
            return m;
        }).toList();
    }
}
