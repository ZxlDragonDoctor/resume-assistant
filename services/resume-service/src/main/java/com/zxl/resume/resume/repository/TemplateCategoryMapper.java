package com.zxl.resume.resume.repository;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.UUID;

/** 创建简历时读取模板分类与配置，用于选择示例内容并应用版式 */
@Mapper
public interface TemplateCategoryMapper {

    @Select("SELECT category FROM templates WHERE id = #{id}")
    String findCategoryById(UUID id);

    @Select("SELECT config FROM templates WHERE id = #{id}")
    String findConfigById(UUID id);
}
