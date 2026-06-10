package com.zxl.resume.resume.controller;

import com.zxl.resume.common.annotation.UserId;
import com.zxl.resume.common.result.R;
import com.zxl.resume.resume.dto.CreateResumeRequest;
import com.zxl.resume.resume.dto.ResumeDetailResponse;
import com.zxl.resume.resume.dto.UpdateSectionRequest;
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

    @GetMapping
    public R<List<Resume>> list(@UserId UUID userId) {
        return R.ok(resumeService.listByUser(userId));
    }

    @GetMapping("/{id}")
    public R<ResumeDetailResponse> detail(@PathVariable UUID id, @UserId UUID userId) {
        return R.ok(resumeService.getDetail(id, userId));
    }

    @PostMapping
    public R<Resume> create(@UserId UUID userId,
                            @Valid @RequestBody CreateResumeRequest req) {
        return R.ok(resumeService.create(userId, req));
    }

    @DeleteMapping("/{id}")
    public R<Void> delete(@PathVariable UUID id, @UserId UUID userId) {
        resumeService.delete(id, userId);
        return R.ok();
    }

    @PatchMapping("/{id}")
    public R<Void> update(@PathVariable UUID id,
                          @UserId UUID userId,
                          @RequestBody Map<String, Object> updates) {
        resumeService.updateResume(id, userId, updates);
        return R.ok();
    }

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
}
