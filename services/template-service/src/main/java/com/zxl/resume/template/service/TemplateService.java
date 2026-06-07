package com.zxl.resume.template.service;

import com.zxl.resume.template.entity.Template;
import com.zxl.resume.template.repository.TemplateMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TemplateService {

    private final TemplateMapper templateMapper;

    public List<Template> listAll() {
        return templateMapper.selectList(null);
    }

    public Template getById(UUID id) {
        Template template = templateMapper.selectById(id);
        if (template == null) {
            throw new IllegalArgumentException("模板不存在");
        }
        return template;
    }
}
