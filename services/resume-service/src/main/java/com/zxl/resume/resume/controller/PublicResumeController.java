package com.zxl.resume.resume.controller;

import com.zxl.resume.common.result.R;
import com.zxl.resume.resume.dto.ResumeDetailResponse;
import com.zxl.resume.resume.service.ResumeService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * 公开只读接口：任何人拿到分享 token 即可查看简历，
 * 不需要登录，也不暴露简历所属用户信息。
 */
@RestController
@RequestMapping("/api/public")
@RequiredArgsConstructor
public class PublicResumeController {

    private final ResumeService resumeService;

    @GetMapping("/resumes/{token}")
    public R<ResumeDetailResponse> shared(@PathVariable String token) {
        return R.ok(resumeService.getSharedDetail(token));
    }
}
