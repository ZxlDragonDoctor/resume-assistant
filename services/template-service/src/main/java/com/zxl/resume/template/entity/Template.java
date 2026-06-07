package com.zxl.resume.template.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.Instant;
import java.util.UUID;

@Data
@TableName("templates")
public class Template {
    @TableId(type = IdType.ASSIGN_UUID)
    private UUID id;

    private String name;
    private String description;
    private String category;

    @TableField("thumbnail_url")
    private String thumbnailUrl;

    @TableField("is_premium")
    private Boolean isPremium;

    private String config;

    @TableField(value = "created_at", fill = FieldFill.INSERT)
    private Instant createdAt;
}
