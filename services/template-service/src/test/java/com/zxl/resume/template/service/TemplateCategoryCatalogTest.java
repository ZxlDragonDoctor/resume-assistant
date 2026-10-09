package com.zxl.resume.template.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class TemplateCategoryCatalogTest {
    @Test
    void normalizesLegacyCategoriesIntoChineseJobDirections() {
        assertEquals("general", TemplateCategoryCatalog.normalize("modern"));
        assertEquals("business", TemplateCategoryCatalog.normalize("classic"));
        assertEquals("design", TemplateCategoryCatalog.normalize("creative"));
        assertEquals("technical", TemplateCategoryCatalog.normalize("data"));
        assertEquals("academic", TemplateCategoryCatalog.normalize("education"));
        assertEquals("custom", TemplateCategoryCatalog.normalize("custom"));
        assertEquals("other", TemplateCategoryCatalog.normalize("unrecognized"));
    }

    @Test
    void exposesChineseLabelsAndLegacyFilterAliases() {
        assertEquals("技术研发", TemplateCategoryCatalog.label("technical"));
        assertEquals(List.of("technical", "data"), TemplateCategoryCatalog.aliases("technical"));
        assertEquals(List.of("business", "classic"), TemplateCategoryCatalog.aliases("business"));
        assertEquals(List.of("design", "creative"), TemplateCategoryCatalog.aliases("design"));
        assertEquals(List.of("academic", "education"), TemplateCategoryCatalog.aliases("academic"));
        assertEquals("其他", TemplateCategoryCatalog.label(null));
        assertEquals("其他", TemplateCategoryCatalog.label("unexpected-key"));
    }
}
