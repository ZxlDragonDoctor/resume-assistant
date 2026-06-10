package com.zxl.resume.resume.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.zxl.resume.common.mybatis.JsonbTypeHandler;
import lombok.Data;
import java.time.Instant;
import java.util.UUID;

@Data
@TableName("resumes")
public class Resume {
    @TableId(type = IdType.INPUT)
    private UUID id;

    @TableField("user_id")
    private UUID userId;

    private String title;

    @TableField("template_id")
    private UUID templateId;

    @TableField("target_job")
    private String targetJob;

    @TableField("target_company")
    private String targetCompany;

    @TableField("font_family")
    private String fontFamily;

    @TableField("font_size")
    private Integer fontSize;

    @TableField("theme_color")
    private String themeColor;

    @TableField("line_spacing")
    private Double lineSpacing;

    @TableField(value = "layout_config", typeHandler = JsonbTypeHandler.class)
    private String layoutConfig;

    @TableField("is_public")
    private Boolean isPublic;

    @TableField(value = "created_at", fill = FieldFill.INSERT)
    private Instant createdAt;

    @TableField(value = "updated_at", fill = FieldFill.INSERT_UPDATE)
    private Instant updatedAt;
}
