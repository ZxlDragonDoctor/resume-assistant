package com.zxl.resume.template.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.zxl.resume.common.mybatis.JsonbTypeHandler;
import com.zxl.resume.template.mybatis.StringListArrayTypeHandler;
import lombok.Data;
import java.time.Instant;
import java.util.List;

@Data
@TableName(value = "templates", autoResultMap = true)
public class Template {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;

    private String name;
    private String description;
    private String category;

    /** 检索用的标签，如「双栏」「研发」「极简」 */
    @TableField(typeHandler = StringListArrayTypeHandler.class)
    private List<String> tags;

    @TableField("thumbnail_url")
    private String thumbnailUrl;

    @TableField("preview_config")
    private String previewConfig;

    @TableField("is_premium")
    private Boolean isPremium;

    @TableField("is_active")
    private Boolean isActive;

    @TableField("sort_order")
    private Integer sortOrder;

    /** 模板完整配置（布局、配色、字体、模块顺序） */
    @TableField(typeHandler = JsonbTypeHandler.class)
    private String config;

    @TableField(value = "created_at", fill = FieldFill.INSERT)
    private Instant createdAt;
}
