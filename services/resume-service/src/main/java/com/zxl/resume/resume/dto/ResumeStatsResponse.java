package com.zxl.resume.resume.dto;

import lombok.Data;

/**
 * 仪表盘统计数据。
 */
@Data
public class ResumeStatsResponse {
    /** 简历总数 */
    private int totalResumes;
    /** 已完成（状态为 complete）的简历数 */
    private int completedResumes;
    /** 草稿数 */
    private int draftResumes;
    /** 已开启分享的简历数 */
    private int sharedResumes;
    /** 累计浏览人次 */
    private long totalViews;
    /** 最近一次编辑时间 */
    private java.time.Instant lastEditedAt;
    /** 简历完成度（0-100），按模块完整度估算的平均值 */
    private int completeness;
}
