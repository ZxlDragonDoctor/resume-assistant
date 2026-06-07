package com.zxl.resume.resume.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import java.util.UUID;

@Data
public class CreateResumeRequest {
    @NotBlank
    private String title;
    private UUID templateId;
}
