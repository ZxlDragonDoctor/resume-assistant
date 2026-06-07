package com.zxl.resume.resume.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.zxl.resume.resume.entity.Resume;
import org.apache.ibatis.annotations.Mapper;
import java.util.List;
import java.util.UUID;

@Mapper
public interface ResumeMapper extends BaseMapper<Resume> {
    List<Resume> findByUserId(UUID userId);
}
