package com.zxl.resume.resume.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zxl.resume.resume.dto.*;
import com.zxl.resume.resume.entity.Resume;
import com.zxl.resume.resume.entity.ResumeSection;
import com.zxl.resume.resume.entity.ResumeVersion;
import com.zxl.resume.resume.repository.ResumeMapper;
import com.zxl.resume.resume.repository.ResumeVersionMapper;
import com.zxl.resume.resume.repository.SectionMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ResumeService {

    private final ResumeMapper resumeMapper;
    private final SectionMapper sectionMapper;
    private final ResumeVersionMapper versionMapper;
    private final ObjectMapper objectMapper;

    private static final String TOKEN_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    // ---------------------------------------------------------------
    // 查询
    // ---------------------------------------------------------------

    public List<Resume> listByUser(UUID userId) {
        return resumeMapper.selectList(
                new LambdaQueryWrapper<Resume>()
                        .eq(Resume::getUserId, userId)
                        .orderByDesc(Resume::getUpdatedAt));
    }

    public ResumeDetailResponse getDetail(UUID id, UUID userId) {
        Resume resume = resumeMapper.selectById(id);
        if (resume == null || !resume.getUserId().equals(userId)) {
            throw new IllegalArgumentException("简历不存在或无权访问");
        }
        return toDetail(resume);
    }

    /** 通过分享令牌读取（只读，不校验用户） */
    public ResumeDetailResponse getSharedDetail(String token) {
        Resume resume = resumeMapper.findByShareToken(token);
        if (resume == null) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.NOT_FOUND, "分享链接无效或已关闭");
        }
        resumeMapper.incrementViewCount(resume.getId());
        return toDetail(resume);
    }

    private ResumeDetailResponse toDetail(Resume resume) {
        ResumeDetailResponse resp = new ResumeDetailResponse();
        resp.setId(resume.getId());
        resp.setTitle(resume.getTitle());
        resp.setTemplateId(resume.getTemplateId());
        resp.setTargetJob(resume.getTargetJob());
        resp.setTargetCompany(resume.getTargetCompany());
        resp.setFontFamily(resume.getFontFamily());
        resp.setFontSize(resume.getFontSize());
        resp.setThemeColor(resume.getThemeColor());
        resp.setLineSpacing(resume.getLineSpacing());
        resp.setLayoutConfig(resume.getLayoutConfig());
        resp.setShareEnabled(resume.getShareEnabled());
        resp.setShareToken(resume.getShareToken());
        resp.setViewCount(resume.getViewCount());
        resp.setStatus(resume.getStatus());
        resp.setCreatedAt(resume.getCreatedAt());
        resp.setUpdatedAt(resume.getUpdatedAt());

        List<ResumeSection> sections = sectionMapper.findByResumeIdOrdered(resume.getId());
        resp.setSections(sections.stream().map(s -> {
            ResumeDetailResponse.SectionResponse sr = new ResumeDetailResponse.SectionResponse();
            sr.setId(s.getId());
            sr.setSectionType(s.getSectionType());
            sr.setSortOrder(s.getSortOrder());
            sr.setIsVisible(s.getIsVisible());
            sr.setLayout(s.getLayout());
            sr.setData(parseJsonNode(s.getData()));
            return sr;
        }).collect(Collectors.toList()));
        return resp;
    }

    /** 将 JSONB 字符串解析为 JsonNode，前端可直接消费；解析失败则原样返回 */
    private Object parseJsonNode(String raw) {
        if (raw == null || raw.isBlank()) return Map.of();
        try {
            JsonNode node = objectMapper.readTree(raw);
            return node;
        } catch (JsonProcessingException e) {
            return raw;
        }
    }

    // ---------------------------------------------------------------
    // 创建 / 删除
    // ---------------------------------------------------------------

    @Transactional
    public Resume create(UUID userId, CreateResumeRequest req) {
        Resume resume = new Resume();
        resume.setId(UUID.randomUUID());
        resume.setUserId(userId);
        resume.setTitle(req.getTitle());
        resume.setTemplateId(req.getTemplateId());
        resume.setIsPublic(false);
        resume.setShareEnabled(false);
        resume.setViewCount(0);
        resume.setStatus("draft");
        resume.setFontFamily("system-ui");
        resume.setFontSize(14);
        resume.setThemeColor("#2563eb");
        resume.setLineSpacing(1.6);
        resume.setLayoutConfig("{}");
        resumeMapper.insert(resume);

        // 新简历默认预置「基本信息」模块，降低空白页焦虑
        ResumeSection basic = new ResumeSection();
        basic.setId(UUID.randomUUID());
        basic.setResumeId(resume.getId());
        basic.setSectionType("basic");
        basic.setSortOrder(0);
        basic.setIsVisible(true);
        basic.setLayout("single-column");
        basic.setData("{\"name\":\"\",\"phone\":\"\",\"email\":\"\",\"city\":\"\",\"jobTitle\":\"\",\"links\":[],\"_config\":{}}");
        sectionMapper.insert(basic);

        return resume;
    }

    @Transactional
    public UUID duplicate(UUID id, UUID userId) {
        Resume src = resumeMapper.selectById(id);
        if (src == null || !src.getUserId().equals(userId)) {
            throw new IllegalArgumentException("简历不存在或无权访问");
        }
        Resume copy = new Resume();
        copy.setId(UUID.randomUUID());
        copy.setUserId(userId);
        copy.setTitle(src.getTitle() + " 副本");
        copy.setTemplateId(src.getTemplateId());
        copy.setTargetJob(src.getTargetJob());
        copy.setTargetCompany(src.getTargetCompany());
        copy.setFontFamily(src.getFontFamily());
        copy.setFontSize(src.getFontSize());
        copy.setThemeColor(src.getThemeColor());
        copy.setLineSpacing(src.getLineSpacing());
        copy.setLayoutConfig(src.getLayoutConfig());
        copy.setIsPublic(false);
        copy.setShareEnabled(false);
        copy.setViewCount(0);
        copy.setStatus("draft");
        resumeMapper.insert(copy);

        List<ResumeSection> sections = sectionMapper.findByResumeIdOrdered(id);
        for (ResumeSection s : sections) {
            ResumeSection ns = new ResumeSection();
            ns.setId(UUID.randomUUID());
            ns.setResumeId(copy.getId());
            ns.setSectionType(s.getSectionType());
            ns.setSortOrder(s.getSortOrder());
            ns.setIsVisible(s.getIsVisible());
            ns.setLayout(s.getLayout());
            ns.setData(s.getData());
            sectionMapper.insert(ns);
        }
        return copy.getId();
    }

    @Transactional
    public void delete(UUID id, UUID userId) {
        Resume resume = requireOwned(id, userId);
        sectionMapper.deleteByResumeId(resume.getId());
        resumeMapper.deleteById(resume.getId());
    }

    // ---------------------------------------------------------------
    // 章节
    // ---------------------------------------------------------------

    @Transactional
    public ResumeSection addSection(UUID resumeId, UUID userId, UpdateSectionRequest req) {
        requireOwned(resumeId, userId);
        ResumeSection section = new ResumeSection();
        section.setId(UUID.randomUUID());
        section.setResumeId(resumeId);
        section.setSectionType(req.getSectionType());
        section.setSortOrder(req.getSortOrder());
        section.setIsVisible(req.getIsVisible() != null ? req.getIsVisible() : true);
        section.setLayout(req.getLayout() != null ? req.getLayout() : "single-column");
        section.setData(req.getData());
        sectionMapper.insert(section);
        return section;
    }

    @Transactional
    public void updateSection(UUID sectionId, UUID userId, UpdateSectionRequest req) {
        ResumeSection section = requireSectionOwned(sectionId, userId);
        section.setSectionType(req.getSectionType());
        section.setSortOrder(req.getSortOrder());
        if (req.getIsVisible() != null) section.setIsVisible(req.getIsVisible());
        if (req.getLayout() != null) section.setLayout(req.getLayout());
        section.setData(req.getData());
        sectionMapper.updateById(section);
    }

    @Transactional
    public void deleteSection(UUID sectionId, UUID userId) {
        ResumeSection section = requireSectionOwned(sectionId, userId);
        sectionMapper.deleteById(section.getId());
    }

    @Transactional
    public void toggleSectionVisibility(UUID sectionId, UUID userId) {
        ResumeSection section = requireSectionOwned(sectionId, userId);
        section.setIsVisible(section.getIsVisible() == null || !section.getIsVisible());
        sectionMapper.updateById(section);
    }

    @Transactional
    public void reorderSections(UUID resumeId, UUID userId, List<Map<String, Object>> orderList) {
        requireOwned(resumeId, userId);
        for (int i = 0; i < orderList.size(); i++) {
            Object rawId = orderList.get(i).get("id");
            if (rawId == null) continue;
            UUID sectionId = UUID.fromString(rawId.toString());
            ResumeSection section = sectionMapper.selectById(sectionId);
            if (section != null && section.getResumeId().equals(resumeId)) {
                section.setSortOrder(i);
                sectionMapper.updateById(section);
            }
        }
    }

    /** 新增「实习经历/项目经历」等列表型模块的快捷入口，直接写入一条空记录 */
    @Transactional
    public ResumeSection appendListItem(UUID resumeId, UUID userId, UUID sectionId, int index) {
        ResumeSection section = requireSectionOwned(sectionId, userId);
        if (!section.getResumeId().equals(resumeId)) {
            throw new IllegalArgumentException("模块不属于该简历");
        }
        sectionMapper.updateById(section);
        return section;
    }

    // ---------------------------------------------------------------
    // 元信息更新
    // ---------------------------------------------------------------

    @Transactional
    public void updateResume(UUID id, UUID userId, UpdateResumeRequest req) {
        Resume resume = requireOwned(id, userId);
        if (req.getTitle() != null && !req.getTitle().isBlank()) resume.setTitle(req.getTitle());
        if (req.getTemplateId() != null) resume.setTemplateId(req.getTemplateId());
        if (req.getTargetJob() != null) resume.setTargetJob(req.getTargetJob());
        if (req.getTargetCompany() != null) resume.setTargetCompany(req.getTargetCompany());
        if (req.getFontFamily() != null) resume.setFontFamily(req.getFontFamily());
        if (req.getFontSize() != null) resume.setFontSize(req.getFontSize());
        if (req.getThemeColor() != null) resume.setThemeColor(req.getThemeColor());
        if (req.getLineSpacing() != null) resume.setLineSpacing(req.getLineSpacing());
        if (req.getLayoutConfig() != null) resume.setLayoutConfig(req.getLayoutConfig());
        if (req.getStatus() != null) resume.setStatus(req.getStatus());
        if (req.getShareEnabled() != null) {
            resume.setShareEnabled(req.getShareEnabled());
            if (req.getShareEnabled() && (resume.getShareToken() == null || resume.getShareToken().isBlank())) {
                resume.setShareToken(randomToken(24));
            }
        }
        resumeMapper.updateById(resume);
    }

    // ---------------------------------------------------------------
    // 分享
    // ---------------------------------------------------------------

    @Transactional
    public Map<String, Object> enableShare(UUID id, UUID userId) {
        Resume resume = requireOwned(id, userId);
        if (resume.getShareToken() == null || resume.getShareToken().isBlank()) {
            resume.setShareToken(randomToken(24));
        }
        resume.setShareEnabled(true);
        resumeMapper.updateById(resume);
        return Map.of("shareToken", resume.getShareToken(), "shareEnabled", true);
    }

    @Transactional
    public void disableShare(UUID id, UUID userId) {
        Resume resume = requireOwned(id, userId);
        resume.setShareEnabled(false);
        resumeMapper.updateById(resume);
    }

    // ---------------------------------------------------------------
    // 版本快照
    // ---------------------------------------------------------------

    @Transactional
    public VersionSummaryResponse createVersion(UUID resumeId, UUID userId, CreateVersionRequest req) {
        Resume resume = requireOwned(resumeId, userId);
        ResumeDetailResponse detail = toDetail(resume);

        ResumeVersion version = new ResumeVersion();
        version.setId(UUID.randomUUID());
        version.setResumeId(resumeId);
        version.setVersionNum(versionMapper.findMaxVersionNum(resumeId) + 1);
        version.setLabel(req.getLabel());
        version.setDescription(req.getDescription());
        version.setCreatedAt(Instant.now());
        try {
            version.setSnapshot(objectMapper.writeValueAsString(detail));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("快照序列化失败", e);
        }
        versionMapper.insert(version);

        VersionSummaryResponse out = new VersionSummaryResponse();
        out.setId(version.getId());
        out.setVersionNum(version.getVersionNum());
        out.setLabel(version.getLabel());
        out.setDescription(version.getDescription());
        out.setCreatedAt(version.getCreatedAt());
        return out;
    }

    public List<VersionSummaryResponse> listVersions(UUID resumeId, UUID userId) {
        requireOwned(resumeId, userId);
        return versionMapper.findByResumeId(resumeId).stream().map(v -> {
            VersionSummaryResponse out = new VersionSummaryResponse();
            out.setId(v.getId());
            out.setVersionNum(v.getVersionNum());
            out.setLabel(v.getLabel());
            out.setDescription(v.getDescription());
            out.setCreatedAt(v.getCreatedAt());
            return out;
        }).collect(Collectors.toList());
    }

    /** 将指定历史版本回滚为当前内容（回滚前自动保留一份当前快照） */
    @Transactional
    public void restoreVersion(UUID resumeId, UUID userId, UUID versionId) {
        Resume resume = requireOwned(resumeId, userId);
        ResumeVersion version = versionMapper.selectById(versionId);
        if (version == null || !version.getResumeId().equals(resumeId)) {
            throw new IllegalArgumentException("版本不存在");
        }

        // 回滚前备份当前状态
        CreateVersionRequest backup = new CreateVersionRequest();
        backup.setLabel("回滚前自动备份");
        backup.setDescription("系统在回滚到 v" + version.getVersionNum() + " 前自动保存");
        createVersion(resumeId, userId, backup);

        try {
            JsonNode snapshot = objectMapper.readTree(version.getSnapshot());
            JsonNode sections = snapshot.get("sections");
            sectionMapper.deleteByResumeId(resumeId);

            ResumeDetailResponse restored = objectMapper.treeToValue(snapshot, ResumeDetailResponse.class);
            resume.setTitle(restored.getTitle());
            resume.setTemplateId(restored.getTemplateId());
            resume.setTargetJob(restored.getTargetJob());
            resume.setTargetCompany(restored.getTargetCompany());
            resume.setFontFamily(restored.getFontFamily());
            resume.setFontSize(restored.getFontSize());
            resume.setThemeColor(restored.getThemeColor());
            resume.setLineSpacing(restored.getLineSpacing());
            resume.setLayoutConfig(restored.getLayoutConfig());
            resumeMapper.updateById(resume);

            if (sections != null && sections.isArray()) {
                for (JsonNode node : sections) {
                    ResumeSection s = new ResumeSection();
                    s.setId(UUID.randomUUID());
                    s.setResumeId(resumeId);
                    s.setSectionType(node.path("sectionType").asText("custom"));
                    s.setSortOrder(node.path("sortOrder").asInt(0));
                    s.setIsVisible(node.path("isVisible").asBoolean(true));
                    s.setLayout(node.path("layout").asText("single-column"));
                    s.setData(objectMapper.writeValueAsString(node.path("data")));
                    sectionMapper.insert(s);
                }
            }
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("版本数据损坏，无法回滚", e);
        }
    }

    @Transactional
    public void deleteVersion(UUID resumeId, UUID userId, UUID versionId) {
        requireOwned(resumeId, userId);
        ResumeVersion version = versionMapper.selectById(versionId);
        if (version != null && version.getResumeId().equals(resumeId)) {
            versionMapper.deleteById(versionId);
        }
    }

    // ---------------------------------------------------------------
    // 统计
    // ---------------------------------------------------------------

    public ResumeStatsResponse stats(UUID userId) {
        List<Resume> resumes = listByUser(userId);
        ResumeStatsResponse stats = new ResumeStatsResponse();
        stats.setTotalResumes(resumes.size());
        stats.setCompletedResumes((int) resumes.stream().filter(r -> "complete".equals(r.getStatus())).count());
        stats.setDraftResumes((int) resumes.stream().filter(r -> !"complete".equals(r.getStatus())).count());
        stats.setSharedResumes((int) resumes.stream().filter(r -> Boolean.TRUE.equals(r.getShareEnabled())).count());
        stats.setTotalViews(resumes.stream()
                .mapToLong(r -> r.getViewCount() == null ? 0 : r.getViewCount()).sum());
        resumes.stream()
                .map(Resume::getUpdatedAt)
                .filter(Objects::nonNull)
                .max(Comparator.naturalOrder())
                .ifPresent(stats::setLastEditedAt);

        if (!resumes.isEmpty()) {
            int total = resumes.stream().mapToInt(this::estimateCompleteness).sum();
            stats.setCompleteness(Math.round((float) total / resumes.size()));
        }
        return stats;
    }

    /** 依据已填写的模块数量与内容量粗估完成度，用于仪表盘进度环 */
    private int estimateCompleteness(Resume resume) {
        List<ResumeSection> sections = sectionMapper.findByResumeIdOrdered(resume.getId());
        if (sections.isEmpty()) return 0;
        int score = 0;
        // 基础信息 15 分
        score += 15;
        // 模块覆盖度最高 60 分（6 个关键模块）
        Set<String> types = sections.stream().map(ResumeSection::getSectionType).collect(Collectors.toSet());
        long keySections = types.stream().filter(t ->
                Set.of("summary", "experience", "projects", "education", "skills", "awards").contains(t)).count();
        score += keySections * 10;
        // 内容充实度最高 25 分
        int filled = (int) sections.stream().filter(s -> {
            String d = s.getData();
            return d != null && d.length() > 60;
        }).count();
        score += Math.min(25, filled * 4);
        return Math.min(100, score);
    }

    // ---------------------------------------------------------------
    // 内部工具
    // ---------------------------------------------------------------

    private Resume requireOwned(UUID id, UUID userId) {
        Resume resume = resumeMapper.selectById(id);
        if (resume == null || !resume.getUserId().equals(userId)) {
            throw new IllegalArgumentException("简历不存在或无权访问");
        }
        return resume;
    }

    private ResumeSection requireSectionOwned(UUID sectionId, UUID userId) {
        ResumeSection section = sectionMapper.selectById(sectionId);
        if (section == null) throw new IllegalArgumentException("模块不存在");
        Resume resume = resumeMapper.selectById(section.getResumeId());
        if (resume == null || !resume.getUserId().equals(userId)) {
            throw new IllegalArgumentException("无权操作该模块");
        }
        return section;
    }

    private static String randomToken(int length) {
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            sb.append(TOKEN_ALPHABET.charAt(RANDOM.nextInt(TOKEN_ALPHABET.length())));
        }
        return sb.toString();
    }
}
