package com.zxl.resume.resume.dto;

import lombok.Data;
import java.time.Instant;
import java.util.UUID;

@Data
public class VersionDetailResponse {
    private UUID id;
    private Integer versionNum;
    private String label;
    private String description;
    private Instant createdAt;
    private ResumeDetailResponse snapshot;
}
