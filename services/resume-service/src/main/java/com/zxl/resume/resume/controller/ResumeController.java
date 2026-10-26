package com.zxl.resume.resume.controller;

import com.zxl.resume.common.annotation.UserId;
import com.zxl.resume.common.result.R;
import com.zxl.resume.resume.dto.*;
import com.zxl.resume.resume.entity.Resume;
import com.zxl.resume.resume.entity.ResumeSection;
import com.zxl.resume.resume.service.ResumeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/resumes")
@RequiredArgsConstructor
public class ResumeController {

    private final ResumeService resumeService;

    @ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class)
    @ResponseStatus(org.springframework.http.HttpStatus.BAD_REQUEST)
    public R<Void> invalidContent(org.springframework.http.converter.HttpMessageNotReadableException error) {
        return R.badRequest("请求内容格式不正确或包含不支持的字段");
    }

    // ---------------- 列表 / 详情 ----------------

    @GetMapping
    public R<List<Resume>> list(@UserId UUID userId) {
        return R.ok(resumeService.listByUser(userId));
    }

    @GetMapping("/stats")
    public R<ResumeStatsResponse> stats(@UserId UUID userId) {
        return R.ok(resumeService.stats(userId));
    }

    @GetMapping("/{id}")
    public R<ResumeDetailResponse> detail(@PathVariable UUID id, @UserId UUID userId) {
        return R.ok(resumeService.getDetail(id, userId));
    }

    // ---------------- 创建 / 复制 / 删除 ----------------

    @PostMapping
    public R<Resume> create(@UserId UUID userId,
                            @Valid @RequestBody CreateResumeRequest req) {
        return R.ok(resumeService.create(userId, req));
    }

    @PostMapping("/{id}/duplicate")
    public R<Map<String, String>> duplicate(@PathVariable UUID id, @UserId UUID userId) {
        UUID newId = resumeService.duplicate(id, userId);
        return R.ok(Map.of("id", newId.toString()));
    }

    @DeleteMapping("/{id}")
    public R<Void> delete(@PathVariable UUID id, @UserId UUID userId) {
        resumeService.delete(id, userId);
        return R.ok();
    }

    // ---------------- 元信息 ----------------

    @PatchMapping("/{id}")
    public R<Void> update(@PathVariable UUID id,
                          @UserId UUID userId,
                          @Valid @RequestBody UpdateResumeRequest req) {
        resumeService.updateResume(id, userId, req);
        return R.ok();
    }

    // ---------------- 分享 ----------------

    @PutMapping("/{id}/content")
    public R<ResumeDetailResponse> saveContent(@PathVariable UUID id, @UserId UUID userId,
                                               @Valid @RequestBody SaveResumeContentRequest req) {
        return R.ok(resumeService.saveContent(id, userId, req));
    }

    @PostMapping("/{id}/share")
    public R<Map<String, Object>> enableShare(@PathVariable UUID id, @UserId UUID userId) {
        return R.ok(resumeService.enableShare(id, userId));
    }

    @DeleteMapping("/{id}/share")
    public R<Void> disableShare(@PathVariable UUID id, @UserId UUID userId) {
        resumeService.disableShare(id, userId);
        return R.ok();
    }

    // ---------------- 章节 ----------------

    @PostMapping("/{id}/sections")
    public R<ResumeSection> addSection(@PathVariable UUID id,
                                       @UserId UUID userId,
                                       @Valid @RequestBody UpdateSectionRequest req) {
        return R.ok(resumeService.addSection(id, userId, req));
    }

    @PutMapping("/sections/{sectionId}")
    public R<Void> updateSection(@PathVariable UUID sectionId,
                                 @UserId UUID userId,
                                 @Valid @RequestBody UpdateSectionRequest req) {
        resumeService.updateSection(sectionId, userId, req);
        return R.ok();
    }

    @PatchMapping("/sections/{sectionId}/visibility")
    public R<Void> toggleVisibility(@PathVariable UUID sectionId, @UserId UUID userId) {
        resumeService.toggleSectionVisibility(sectionId, userId);
        return R.ok();
    }

    @DeleteMapping("/sections/{sectionId}")
    public R<Void> deleteSection(@PathVariable UUID sectionId,
                                 @UserId UUID userId) {
        resumeService.deleteSection(sectionId, userId);
        return R.ok();
    }

    @PostMapping("/{id}/sections/reorder")
    public R<Void> reorder(@PathVariable UUID id,
                           @UserId UUID userId,
                           @RequestBody List<Map<String, Object>> orderList) {
        resumeService.reorderSections(id, userId, orderList);
        return R.ok();
    }

    // ---------------- 版本 ----------------

    @GetMapping("/{id}/versions")
    public R<List<VersionSummaryResponse>> versions(@PathVariable UUID id, @UserId UUID userId) {
        return R.ok(resumeService.listVersions(id, userId));
    }

    @PostMapping("/{id}/versions")
    public R<VersionSummaryResponse> createVersion(@PathVariable UUID id,
                                                   @UserId UUID userId,
                                                   @Valid @RequestBody CreateVersionRequest req) {
        return R.ok(resumeService.createVersion(id, userId, req));
    }

    @GetMapping("/{id}/versions/{versionId}")
    public R<VersionDetailResponse> versionDetail(@PathVariable UUID id, @PathVariable UUID versionId,
                                                 @UserId UUID userId) {
        return R.ok(resumeService.getVersionDetail(id, userId, versionId));
    }

    @PostMapping("/{id}/versions/{versionId}/restore")
    public R<Void> restoreVersion(@PathVariable UUID id,
                                  @PathVariable UUID versionId,
                                  @UserId UUID userId) {
        resumeService.restoreVersion(id, userId, versionId);
        return R.ok();
    }

    @DeleteMapping("/{id}/versions/{versionId}")
    public R<Void> deleteVersion(@PathVariable UUID id,
                                 @PathVariable UUID versionId,
                                 @UserId UUID userId) {
        resumeService.deleteVersion(id, userId, versionId);
        return R.ok();
    }
}
