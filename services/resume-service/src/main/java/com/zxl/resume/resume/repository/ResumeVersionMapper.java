package com.zxl.resume.resume.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.zxl.resume.resume.entity.ResumeVersion;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.UUID;

@Mapper
public interface ResumeVersionMapper extends BaseMapper<ResumeVersion> {

    @Select("SELECT * FROM resume_versions WHERE resume_id = #{resumeId} ORDER BY version_num DESC")
    List<ResumeVersion> findByResumeId(UUID resumeId);

    @Select("SELECT COALESCE(MAX(version_num), 0) FROM resume_versions WHERE resume_id = #{resumeId}")
    int findMaxVersionNum(UUID resumeId);

    @Select("SELECT * FROM resume_versions WHERE resume_id = #{resumeId} AND version_num = #{versionNum}")
    ResumeVersion findByResumeIdAndVersion(@Param("resumeId") UUID resumeId,
                                           @Param("versionNum") Integer versionNum);
}
