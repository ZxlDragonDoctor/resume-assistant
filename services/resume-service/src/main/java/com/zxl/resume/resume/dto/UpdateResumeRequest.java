package com.zxl.resume.resume.dto;

import lombok.Data;

import java.util.UUID;

/**
 * 简历元信息更新请求。字段全部可选，仅更新非 null 项，
 * 避免 PATCH 语义下误清空用户已有配置。
 */
@Data
public class UpdateResumeRequest {
    private String title;
    private UUID templateId;
    private String targetJob;
    private String targetCompany;
    private String fontFamily;
    private Integer fontSize;
    private String themeColor;
    private Double lineSpacing;
    private String layoutConfig;
    private Boolean shareEnabled;
    private String status;
}
