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
}
