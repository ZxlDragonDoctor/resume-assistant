package com.zxl.resume.template.controller;

import com.zxl.resume.common.result.R;
import com.zxl.resume.template.entity.Template;
import com.zxl.resume.template.service.TemplateService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/templates")
@RequiredArgsConstructor
public class TemplateController {

    private final TemplateService templateService;

    @GetMapping
    public R<List<Template>> list(@RequestParam(required = false) String category,
                                  @RequestParam(required = false) String keyword) {
        return R.ok(templateService.list(category, keyword));
    }

    @GetMapping("/categories")
    public R<List<Map<String, Object>>> categories() {
        return R.ok(templateService.categories());
    }

    @GetMapping("/{id}")
    public R<Template> detail(@PathVariable UUID id) {
        return R.ok(templateService.getById(id));
    }

    /** 把当前简历样式保存为我的模板 */
    @PostMapping
    public R<Template> create(@RequestBody CreateTemplateRequest req) {
        return R.ok(templateService.create(req.getName(), req.getDescription(), req.getCategory(),
                req.getTags(), req.getConfig()));
    }

    public static class CreateTemplateRequest {
        private String name;
        private String description;
        private String category;
        private List<String> tags;
        private String config;

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
        public String getCategory() { return category; }
        public void setCategory(String category) { this.category = category; }
        public List<String> getTags() { return tags; }
        public void setTags(List<String> tags) { this.tags = tags; }
        public String getConfig() { return config; }
        public void setConfig(String config) { this.config = config; }
    }
}
