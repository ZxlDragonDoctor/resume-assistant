package com.zxl.resume.resume.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.Instant;
import java.util.UUID;

@Data
@TableName("resume_sections")
public class ResumeSection {
    @TableId(type = IdType.INPUT)
    private UUID id;

    @TableField("resume_id")
    private UUID resumeId;

    @TableField("section_type")
    private String sectionType;

    @TableField("sort_order")
    private Integer sortOrder;

    @TableField("is_visible")
    private Boolean isVisible;

    /** 模块在页面中的排布方式：single-column / two-column / sidebar */
    private String layout;

    @TableField(typeHandler = com.zxl.resume.common.mybatis.JsonbTypeHandler.class)
    private String data;

    @TableField(value = "created_at", fill = FieldFill.INSERT)
    private Instant createdAt;

    @TableField(value = "updated_at", fill = FieldFill.INSERT_UPDATE)
    private Instant updatedAt;
}
