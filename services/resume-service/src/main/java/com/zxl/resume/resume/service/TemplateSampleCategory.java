package com.zxl.resume.resume.service;

import java.util.Locale;
import java.util.Map;

/** Maps current and historical template categories to the sample resume to seed. */
public final class TemplateSampleCategory {
    private static final Map<String, String> SAMPLES = Map.ofEntries(
            Map.entry("general", "general"), Map.entry("modern", "general"),
            Map.entry("graduate", "graduate"),
            Map.entry("technical", "technical"), Map.entry("data", "data"),
            Map.entry("product", "product"),
            Map.entry("design", "design"), Map.entry("creative", "design"),
            Map.entry("business", "business"), Map.entry("classic", "business"),
            Map.entry("academic", "academic"), Map.entry("education", "academic"),
            Map.entry("medical", "medical"));

    private TemplateSampleCategory() { }

    public static String select(String category) {
        if (category == null || category.isBlank()) return "general";
        return SAMPLES.getOrDefault(category.trim().toLowerCase(Locale.ROOT), "general");
    }
}
