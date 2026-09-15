package com.zxl.resume.resume.dto;

import lombok.Data;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
public class ResumeDetailResponse {
    private UUID id;
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
    private String shareToken;
    private Integer viewCount;
    private String status;
    private Instant createdAt;
    private Instant updatedAt;
    private List<SectionResponse> sections;

    @Data
    public static class SectionResponse {
        private UUID id;
        private String sectionType;
        private Integer sortOrder;
        private Boolean isVisible;
        private String layout;
        private Object data;
    }
}
