package com.zxl.resume.resume.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.zxl.resume.resume.entity.Resume;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;
import java.util.UUID;

@Mapper
public interface ResumeMapper extends BaseMapper<Resume> {

    List<Resume> findByUserId(UUID userId);

    @Select("SELECT * FROM resumes WHERE id = #{id} FOR UPDATE")
    Resume findByIdForUpdate(UUID id);

    /** Explicit columns allow nullable editable fields to be cleared without touching sharing/counters. */
    @Update("UPDATE resumes SET title=#{title}, template_id=#{templateId}, target_job=#{targetJob}, "
            + "target_company=#{targetCompany}, font_family=#{fontFamily}, font_size=#{fontSize}, "
            + "theme_color=#{themeColor}, line_spacing=#{lineSpacing}, layout_config=CAST(#{layoutConfig} AS jsonb), "
            + "updated_at=GREATEST(clock_timestamp(), updated_at + INTERVAL '1 microsecond') WHERE id=#{id}")
    int replaceContent(Resume resume);

    @Update("UPDATE resumes SET updated_at=GREATEST(clock_timestamp(), updated_at + INTERVAL '1 microsecond') WHERE id=#{id}")
    void touchContent(UUID id);

    @Select("SELECT * FROM resumes WHERE share_token = #{token} AND share_enabled = TRUE")
    Resume findByShareToken(String token);

    @Update("UPDATE resumes SET view_count = COALESCE(view_count, 0) + 1 WHERE id = #{id}")
    void incrementViewCount(UUID id);

    @Select("SELECT COUNT(*) FROM resumes WHERE user_id = #{userId}")
    int countByUserId(UUID userId);
}
