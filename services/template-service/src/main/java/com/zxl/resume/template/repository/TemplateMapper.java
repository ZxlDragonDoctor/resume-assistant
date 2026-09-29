package com.zxl.resume.template.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.zxl.resume.template.entity.Template;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.Map;
import java.util.UUID;

@Mapper
public interface TemplateMapper extends BaseMapper<Template> {

    @Insert("INSERT INTO templates (id, name, description, category, tags, config, preview_config, is_premium, is_active, sort_order) "
            + "VALUES (#{p.id}, #{p.name}, #{p.description}, #{p.category}, ARRAY[]::text[], CAST(#{p.config} AS jsonb), '{}'::jsonb, false, true, 100)")
    int insertCustom(@Param("p") Map<String, Object> p);
}
