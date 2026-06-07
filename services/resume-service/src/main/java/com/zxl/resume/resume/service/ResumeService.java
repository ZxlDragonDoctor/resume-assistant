package com.zxl.resume.resume.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zxl.resume.resume.dto.CreateResumeRequest;
import com.zxl.resume.resume.dto.ResumeDetailResponse;
import com.zxl.resume.resume.dto.UpdateSectionRequest;
import com.zxl.resume.resume.entity.Resume;
import com.zxl.resume.resume.entity.ResumeSection;
import com.zxl.resume.resume.repository.ResumeMapper;
import com.zxl.resume.resume.repository.SectionMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ResumeService {

    private final ResumeMapper resumeMapper;
    private final SectionMapper sectionMapper;
    private final ObjectMapper objectMapper;

    public List<Resume> listByUser(UUID userId) {
        return resumeMapper.selectList(
                new LambdaQueryWrapper<Resume>()
                        .eq(Resume::getUserId, userId)
                        .orderByDesc(Resume::getUpdatedAt));
    }

    public ResumeDetailResponse getDetail(UUID id, UUID userId) {
        Resume resume = resumeMapper.selectById(id);
        if (resume == null || !resume.getUserId().equals(userId)) {
            throw new IllegalArgumentException("简历不存在");
        }
        ResumeDetailResponse resp = new ResumeDetailResponse();
        resp.setId(resume.getId());
        resp.setTitle(resume.getTitle());
        resp.setTemplateId(resume.getTemplateId());
        resp.setTargetJob(resume.getTargetJob());
        resp.setTargetCompany(resume.getTargetCompany());
        resp.setFontFamily(resume.getFontFamily());
        resp.setFontSize(resume.getFontSize());
        resp.setThemeColor(resume.getThemeColor());
        resp.setLayoutConfig(resume.getLayoutConfig());

        List<ResumeSection> sections = sectionMapper.findByResumeIdOrdered(id);
        resp.setSections(sections.stream().map(s -> {
            ResumeDetailResponse.SectionResponse sr = new ResumeDetailResponse.SectionResponse();
            sr.setId(s.getId());
            sr.setSectionType(s.getSectionType());
            sr.setSortOrder(s.getSortOrder());
            sr.setIsVisible(s.getIsVisible());
            try {
                sr.setData(objectMapper.readValue(s.getData(), Map.class));
            } catch (JsonProcessingException e) {
                sr.setData(s.getData());
            }
            return sr;
        }).collect(Collectors.toList()));

        return resp;
    }

    @Transactional
    public Resume create(UUID userId, CreateResumeRequest req) {
        Resume resume = new Resume();
        resume.setId(UUID.randomUUID());
        resume.setUserId(userId);
        resume.setTitle(req.getTitle());
        resume.setTemplateId(req.getTemplateId());
        resume.setIsPublic(false);
        resumeMapper.insert(resume);
        return resume;
    }

    @Transactional
    public void delete(UUID id, UUID userId) {
        Resume resume = resumeMapper.selectById(id);
        if (resume == null || !resume.getUserId().equals(userId)) {
            throw new IllegalArgumentException("简历不存在");
        }
        sectionMapper.deleteByResumeId(id);
        resumeMapper.deleteById(id);
    }

    @Transactional
    public ResumeSection addSection(UUID resumeId, UUID userId, UpdateSectionRequest req) {
        Resume resume = resumeMapper.selectById(resumeId);
        if (resume == null || !resume.getUserId().equals(userId)) {
            throw new IllegalArgumentException("简历不存在");
        }
        ResumeSection section = new ResumeSection();
        section.setId(UUID.randomUUID());
        section.setResumeId(resumeId);
        section.setSectionType(req.getSectionType());
        section.setSortOrder(req.getSortOrder());
        section.setIsVisible(req.getIsVisible() != null ? req.getIsVisible() : true);
        section.setData(req.getData());
        sectionMapper.insert(section);
        return section;
    }

    @Transactional
    public void updateSection(UUID sectionId, UUID userId, UpdateSectionRequest req) {
        ResumeSection section = sectionMapper.selectById(sectionId);
        if (section == null) {
            throw new IllegalArgumentException("章节不存在");
        }
        Resume resume = resumeMapper.selectById(section.getResumeId());
        if (resume == null || !resume.getUserId().equals(userId)) {
            throw new IllegalArgumentException("无权操作");
        }
        section.setSectionType(req.getSectionType());
        section.setSortOrder(req.getSortOrder());
        section.setIsVisible(req.getIsVisible() != null ? req.getIsVisible() : section.getIsVisible());
        section.setData(req.getData());
        sectionMapper.updateById(section);
    }

    @Transactional
    public void updateResume(UUID id, UUID userId, Map<String, Object> updates) {
        Resume resume = resumeMapper.selectById(id);
        if (resume == null || !resume.getUserId().equals(userId)) {
            throw new IllegalArgumentException("简历不存在");
        }
        if (updates.containsKey("title")) resume.setTitle((String) updates.get("title"));
        if (updates.containsKey("templateId")) resume.setTemplateId(UUID.fromString((String) updates.get("templateId")));
        if (updates.containsKey("targetJob")) resume.setTargetJob((String) updates.get("targetJob"));
        if (updates.containsKey("targetCompany")) resume.setTargetCompany((String) updates.get("targetCompany"));
        if (updates.containsKey("fontFamily")) resume.setFontFamily((String) updates.get("fontFamily"));
        if (updates.containsKey("fontSize")) resume.setFontSize((Integer) updates.get("fontSize"));
        if (updates.containsKey("themeColor")) resume.setThemeColor((String) updates.get("themeColor"));
        if (updates.containsKey("layoutConfig")) resume.setLayoutConfig((String) updates.get("layoutConfig"));
        resumeMapper.updateById(resume);
    }

    @Transactional
    public void reorderSections(UUID resumeId, UUID userId, List<Map<String, Object>> orderList) {
        Resume resume = resumeMapper.selectById(resumeId);
        if (resume == null || !resume.getUserId().equals(userId)) {
            throw new IllegalArgumentException("简历不存在");
        }
        for (int i = 0; i < orderList.size(); i++) {
            Map<String, Object> item = orderList.get(i);
            UUID sectionId = UUID.fromString((String) item.get("id"));
            ResumeSection section = sectionMapper.selectById(sectionId);
            if (section != null && section.getResumeId().equals(resumeId)) {
                section.setSortOrder(i);
                sectionMapper.updateById(section);
            }
        }
    }
}
