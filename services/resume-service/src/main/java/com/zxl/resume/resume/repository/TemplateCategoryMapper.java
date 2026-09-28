package com.zxl.resume.resume.repository;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.UUID;

/** 仅用于创建简历时读取模板分类，以选择对应示例内容 */
@Mapper
public interface TemplateCategoryMapper {

    @Select("SELECT category FROM templates WHERE id = #{id}")
    String findCategoryById(UUID id);
}
