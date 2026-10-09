package com.zxl.resume.template.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Canonical job-direction taxonomy shared by template filters and counts. */
public final class TemplateCategoryCatalog {
    private static final List<String> ORDER = List.of(
            "general", "graduate", "technical", "product", "design",
            "business", "academic", "medical", "custom", "other");

    private static final Map<String, String> LABELS = Map.ofEntries(
            Map.entry("general", "通用求职"),
            Map.entry("graduate", "应届校招"),
            Map.entry("technical", "技术研发"),
            Map.entry("product", "产品运营"),
            Map.entry("design", "设计创意"),
            Map.entry("business", "商务职能"),
            Map.entry("academic", "学术教育"),
            Map.entry("medical", "医疗健康"),
            Map.entry("custom", "自定义模板"),
            Map.entry("other", "其他"));

    private static final Map<String, List<String>> ALIASES = aliasesByCategory();

    private TemplateCategoryCatalog() { }

    public static List<String> order() {
        return ORDER;
    }

    public static String normalize(String category) {
        if (category == null || category.isBlank()) return "other";
        String key = category.trim().toLowerCase(Locale.ROOT);
        for (Map.Entry<String, List<String>> entry : ALIASES.entrySet()) {
            if (entry.getValue().contains(key)) return entry.getKey();
        }
        return "other";
    }

    public static String label(String category) {
        return LABELS.get(normalize(category));
    }

    public static List<String> aliases(String category) {
        return ALIASES.getOrDefault(normalize(category), ALIASES.get("other"));
    }

    private static Map<String, List<String>> aliasesByCategory() {
        Map<String, List<String>> aliases = new LinkedHashMap<>();
        aliases.put("general", List.of("general", "modern"));
        aliases.put("graduate", List.of("graduate"));
        aliases.put("technical", List.of("technical", "data"));
        aliases.put("product", List.of("product"));
        aliases.put("design", List.of("design", "creative"));
        aliases.put("business", List.of("business", "classic"));
        aliases.put("academic", List.of("academic", "education"));
        aliases.put("medical", List.of("medical"));
        aliases.put("custom", List.of("custom"));
        aliases.put("other", List.of("other"));
        return Map.copyOf(aliases);
    }
}
