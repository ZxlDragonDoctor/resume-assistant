package com.zxl.resume.resume.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.zxl.resume.common.mybatis.JsonbTypeHandler;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

/**
 * 简历版本快照。每次「保存版本」会写入一份完整快照，
 * 便于用户回滚到任意历史节点。
 */
@Data
@TableName("resume_versions")
public class ResumeVersion {

    @TableId(type = IdType.INPUT)
    private UUID id;

    private UUID resumeId;

    private Integer versionNum;

    private String label;

    /** 完整简历快照（含 sections），由 Jackson 序列化为 JSONB */
    @TableField(typeHandler = JsonbTypeHandler.class)
    private String snapshot;

    private String description;

    private Instant createdAt;
}
