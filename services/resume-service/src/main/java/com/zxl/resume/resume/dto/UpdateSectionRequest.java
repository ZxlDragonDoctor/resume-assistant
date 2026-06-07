package com.zxl.resume.resume.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UpdateSectionRequest {
    @NotBlank
    private String sectionType;

    @NotNull
    private Integer sortOrder;

    private Boolean isVisible;

    @NotNull
    private String data;
}
