package com.zxl.resume.resume.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateVersionRequest {
    @NotBlank
    private String label;
    private String description;
}
