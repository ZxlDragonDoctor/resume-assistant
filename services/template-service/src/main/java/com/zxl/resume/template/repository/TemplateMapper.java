package com.zxl.resume.template.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.zxl.resume.template.entity.Template;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface TemplateMapper extends BaseMapper<Template> {
}
