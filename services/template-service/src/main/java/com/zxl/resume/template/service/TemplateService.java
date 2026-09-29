package com.zxl.resume.template.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.zxl.resume.template.entity.Template;
import com.zxl.resume.template.repository.TemplateMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TemplateService {

    private final TemplateMapper templateMapper;


    /** 用户把当前简历样式保存为自定义模板 */
    public Template create(String name, String description, String category,
                           List<String> tags, String config) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("模板名称不能为空");
        }
        Template t = new Template();
        t.setId(UUID.randomUUID());
        t.setName(name.trim());
        t.setDescription(description == null ? "我的自定义模板" : description);
        t.setCategory(category == null || category.isBlank() ? "custom" : category);
        t.setTags(tags == null ? List.of("自定义") : tags);
        t.setConfig(config == null || config.isBlank() ? "{}" : config);
        t.setPreviewConfig("{}");
        t.setIsPremium(false);
        t.setIsActive(true);
        t.setSortOrder(100);
        templateMapper.insert(t);
        return t;
    }

    /** 按分类筛选模板；category 为空时返回全部启用中的模板 */
    public List<Template> list(String category, String keyword) {
        LambdaQueryWrapper<Template> q = new LambdaQueryWrapper<Template>()
                .ne(Template::getIsActive, false)
                .orderByAsc(Template::getSortOrder);
        if (StringUtils.hasText(category) && !"all".equalsIgnoreCase(category)) {
            q.eq(Template::getCategory, category);
        }
        if (StringUtils.hasText(keyword)) {
            q.and(w -> w.like(Template::getName, keyword).or().like(Template::getDescription, keyword));
        }
        return templateMapper.selectList(q);
    }

    public Template getById(UUID id) {
        Template template = templateMapper.selectById(id);
        if (template == null) {
            throw new IllegalArgumentException("模板不存在");
        }
        return template;
    }

    /** 分类列表 + 每个分类的模板数量，用于模板库的筛选侧栏 */
    public List<Map<String, Object>> categories() {
        List<Template> all = list(null, null);
        Map<String, Long> counts = all.stream()
                .collect(Collectors.groupingBy(
                        t -> t.getCategory() == null ? "other" : t.getCategory(),
                        LinkedHashMap::new, Collectors.counting()));
        return counts.entrySet().stream().map(e -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("key", e.getKey());
            m.put("label", CATEGORY_LABELS.getOrDefault(e.getKey(), e.getKey()));
            m.put("count", e.getValue());
            return m;
        }).collect(Collectors.toList());
    }

    private static final Map<String, String> CATEGORY_LABELS = Map.of(
            "modern", "简约现代",
            "classic", "经典稳重",
            "creative", "创意设计",
            "technical", "技术研发",
            "academic", "学术科研",
            "business", "商务金融",
            "other", "其他"
    );
}
