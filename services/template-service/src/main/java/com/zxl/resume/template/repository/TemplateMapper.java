package com.zxl.resume.template.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.baomidou.mybatisplus.core.toolkit.Constants;
import com.zxl.resume.template.entity.Template;
import com.zxl.resume.template.mybatis.StringListArrayTypeHandler;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.ResultMap;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.UUID;

@Mapper
public interface TemplateMapper extends BaseMapper<Template> {

    @Select("SELECT id::text AS id, name, description, category, tags, thumbnail_url, "
            + "preview_config, is_premium, is_active, sort_order, config, created_at "
            + "FROM templates ${ew.customSqlSegment}")
    @Results(id = "templateResultMap", value = @Result(column = "tags", property = "tags",
            typeHandler = StringListArrayTypeHandler.class))
    List<Template> selectTemplateList(@Param(Constants.WRAPPER) Wrapper<Template> queryWrapper);

    @Select("SELECT id::text AS id, name, description, category, tags, thumbnail_url, "
            + "preview_config, is_premium, is_active, sort_order, config, created_at "
            + "FROM templates WHERE id = CAST(#{id} AS uuid)")
    @ResultMap("templateResultMap")
    Template selectTemplateById(@Param("id") String id);

    @Insert("INSERT INTO templates (id, name, description, category, tags, config, preview_config, is_premium, is_active, sort_order) "
            + "VALUES (#{id}, #{name}, #{description}, #{category}, ARRAY[]::text[], "
            + "CAST(#{configJson} AS jsonb), '{}'::jsonb, FALSE, TRUE, 100)")
    int insertCustom(@Param("id") UUID id,
                     @Param("name") String name,
                     @Param("description") String description,
                     @Param("category") String category,
                     @Param("configJson") String configJson);
}
