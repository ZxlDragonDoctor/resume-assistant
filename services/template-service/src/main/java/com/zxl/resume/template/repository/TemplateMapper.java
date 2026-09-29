package com.zxl.resume.template.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.zxl.resume.template.entity.Template;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.UUID;

@Mapper
public interface TemplateMapper extends BaseMapper<Template> {

    @Insert("INSERT INTO templates (id, name, description, category, tags, config, preview_config, is_premium, is_active, sort_order) "
            + "VALUES (#{id}, #{name}, #{description}, #{category}, ARRAY[]::text[], "
            + "CAST(#{configJson} AS jsonb), '{}'::jsonb, FALSE, TRUE, 100)")
    int insertCustom(@Param("id") UUID id,
                     @Param("name") String name,
                     @Param("description") String description,
                     @Param("category") String category,
                     @Param("configJson") String configJson);
}
