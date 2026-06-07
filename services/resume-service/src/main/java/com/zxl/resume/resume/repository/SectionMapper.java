package com.zxl.resume.resume.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.zxl.resume.resume.entity.ResumeSection;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import java.util.List;
import java.util.UUID;

@Mapper
public interface SectionMapper extends BaseMapper<ResumeSection> {
    @Select("SELECT * FROM resume_sections WHERE resume_id = #{resumeId} ORDER BY sort_order")
    List<ResumeSection> findByResumeIdOrdered(UUID resumeId);

    @Select("DELETE FROM resume_sections WHERE resume_id = #{resumeId}")
    void deleteByResumeId(UUID resumeId);
}
