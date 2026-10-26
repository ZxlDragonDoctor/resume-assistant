package com.zxl.resume.resume.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.Data;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Complete editable content. Sharing, ownership and counters are intentionally excluded. */
@Data
public class SaveResumeContentRequest {
    @NotBlank @Size(max = 200) private String title;
    @Size(max = 200) private String targetJob;
    @Size(max = 200) private String targetCompany;
    private UUID templateId;
    @NotBlank @Size(max = 100) private String fontFamily;
    @NotNull @Min(8) @Max(72) private Integer fontSize;
    @NotNull @Pattern(regexp = "#[0-9a-fA-F]{6}") private String themeColor;
    @NotNull @DecimalMin("1.0") @DecimalMax("3.0") private Double lineSpacing;
    @NotNull @Size(max = 65536) private String layoutConfig;
    @NotNull @Size(max = 100) @Valid private List<@NotNull Section> sections;
    @NotNull private Instant expectedUpdatedAt;
    @Size(max = 100) private String label;
    @Size(max = 500) private String description;

    @JsonAnySetter
    public void rejectUnknown(String name, JsonNode value) {
        throw new IllegalArgumentException("不支持的保存字段: " + name);
    }

    @Data
    public static class Section {
        @NotNull private UUID id;
        @NotBlank @Size(max = 50) private String sectionType;
        @NotNull @Min(0) @Max(10000) private Integer sortOrder;
        @NotNull private Boolean isVisible;
        @NotBlank @Size(max = 20) private String layout;
        @NotNull private JsonNode data;
        @JsonAnySetter
        public void rejectUnknown(String name, JsonNode value) {
            throw new IllegalArgumentException("不支持的模块字段: " + name);
        }
    }
}
