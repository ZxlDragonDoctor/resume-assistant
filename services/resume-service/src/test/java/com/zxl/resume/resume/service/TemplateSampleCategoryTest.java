package com.zxl.resume.resume.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class TemplateSampleCategoryTest {
    @Test
    void selectsSamplesForEveryJobDirection() {
        assertEquals("general", TemplateSampleCategory.select("general"));
        assertEquals("graduate", TemplateSampleCategory.select("graduate"));
        assertEquals("technical", TemplateSampleCategory.select("technical"));
        assertEquals("product", TemplateSampleCategory.select("product"));
        assertEquals("design", TemplateSampleCategory.select("design"));
        assertEquals("business", TemplateSampleCategory.select("business"));
        assertEquals("academic", TemplateSampleCategory.select("academic"));
        assertEquals("medical", TemplateSampleCategory.select("medical"));
    }

    @Test
    void supportsLegacyCategoriesAndFallsBackToGeneral() {
        assertEquals("academic", TemplateSampleCategory.select("education"));
        assertEquals("data", TemplateSampleCategory.select("data"));
        assertEquals("business", TemplateSampleCategory.select("classic"));
        assertEquals("design", TemplateSampleCategory.select("creative"));
        assertEquals("general", TemplateSampleCategory.select("unknown"));
        assertEquals("general", TemplateSampleCategory.select(null));
    }
}
