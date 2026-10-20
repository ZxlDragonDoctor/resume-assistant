package com.zxl.resume.resume.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Validates a complete versioned sample before any of its sections are inserted. */
public final class TemplateSampleContent {
    private static final Set<String> TYPES = Set.of("basic", "summary", "experience", "work",
            "education", "projects", "skills", "awards", "certificates", "custom");
    private static final Set<String> LAYOUTS = Set.of("auto", "left", "right", "single-column");
    private static final String[] ENTRY_STRINGS = { "title", "subtitle", "company", "school", "name",
            "institution", "position", "degree", "major", "role", "department", "tech", "level", "date",
            "startDate", "endDate", "description", "link" };

    private TemplateSampleContent() { }

    public record Section(String type, int order, String layout, String data) { }

    /** Empty means a legacy or invalid preview; callers can use the category fallback. */
    public static List<Section> parse(ObjectMapper mapper, String raw) {
        if (raw == null || raw.isBlank()) return List.of();
        try {
            JsonNode root = mapper.readTree(raw);
            if (root == null || !root.isObject() || !root.path("version").isNumber()
                    || root.path("version").asDouble() != 1
                    || !validProfile(root.path("profile"))) return List.of();
            JsonNode nodes = root.path("sections");
            if (!nodes.isArray() || nodes.isEmpty() || nodes.size() > 30) return List.of();
            List<Section> result = new ArrayList<>();
            Set<Integer> orders = new HashSet<>();
            int basics = 0;
            for (JsonNode node : nodes) {
                String type = node.path("sectionType").asText("");
                JsonNode order = node.path("sortOrder");
                String layout = node.has("layout") ? node.path("layout").asText("") : "auto";
                if (!node.isObject() || !TYPES.contains(type) || !validData(type, node.path("data"))
                        || !wholeNumber(order) || order.asDouble() > Integer.MAX_VALUE || order.asDouble() < 0
                        || !orders.add(order.asInt()) || (node.has("layout") && !node.path("layout").isTextual())
                        || !LAYOUTS.contains(layout)) return List.of();
                if ("basic".equals(type)) basics++;
                result.add(new Section(type, order.asInt(), layout, mapper.writeValueAsString(node.get("data"))));
            }
            if (basics != 1) return List.of();
            result.sort(Comparator.comparingInt(Section::order));
            return List.copyOf(result);
        } catch (JsonProcessingException e) {
            return List.of();
        }
    }

    // Keep the runtime contract aligned with frontend/src/utils/templateSample.ts.
    private static boolean validProfile(JsonNode profile) {
        JsonNode pages = profile.path("suggestedPages");
        JsonNode highlights = profile.path("highlights");
        if (!profile.isObject() || !hasText(profile.path("key")) || !hasText(profile.path("jobTitle"))
                || !hasText(profile.path("experienceLevel")) || !stringList(highlights) || highlights.isEmpty()
                || !wholeNumber(pages) || pages.asDouble() < 1) return false;
        for (JsonNode highlight : highlights) if (!hasText(highlight)) return false;
        return true;
    }

    private static boolean validData(String type, JsonNode data) {
        if (!data.isObject() || !validConfig(data.path("_config"))) return false;
        if ("basic".equals(type)) {
            if (!hasText(data.path("name")) || !hasText(data.path("jobTitle"))
                    || !optionalStrings(data, "name", "jobTitle", "phone", "email", "city", "website")) return false;
            if (data.has("links")) {
                if (!data.path("links").isArray()) return false;
                for (JsonNode link : data.path("links")) {
                    if (!link.isObject() || !link.path("label").isTextual() || !link.path("url").isTextual()) return false;
                }
            }
            return true;
        }
        if ("summary".equals(type) || "custom".equals(type)) return hasText(data.path("content"));
        JsonNode items = data.path("items");
        if (!items.isArray() || items.isEmpty()) return false;
        for (JsonNode item : items) {
            if ("skills".equals(type)) {
                if (hasText(item)) continue;
                if (!item.isObject() || !optionalStrings(item, "name", "category", "value")
                        || (!hasText(item.path("name")) && !hasText(item.path("category")))
                        || !(stringList(item.path("items")) || (!item.has("items") && hasText(item.path("value"))))) return false;
            } else if (!item.isObject() || !optionalStrings(item, ENTRY_STRINGS)
                    || (item.has("current") && !item.path("current").isBoolean())
                    || (item.has("bullets") && !stringList(item.path("bullets")))) return false;
        }
        return true;
    }

    private static boolean validConfig(JsonNode config) {
        if (config.isMissingNode()) return true;
        if (!config.isObject() || !optionalStrings(config, "moduleName", "titleColor", "textColor")) return false;
        for (String field : List.of("titleFontSize", "contentFontSize", "lineSpacing")) {
            JsonNode value = config.path(field);
            if (!value.isMissingNode() && (!value.isNumber() || !Double.isFinite(value.asDouble()) || value.asDouble() <= 0)) return false;
        }
        if (config.has("textAlign") && !Set.of("left", "center", "right").contains(config.path("textAlign").asText(""))) return false;
        if (config.has("titleStyle") && !Set.of("underline", "bar", "pill", "solid", "plain").contains(config.path("titleStyle").asText(""))) return false;
        return (!config.has("hideTitle") || config.path("hideTitle").isBoolean())
                && (!config.has("markdownMode") || config.path("markdownMode").isBoolean());
    }

    private static boolean hasText(JsonNode node) {
        return node.isTextual() && !node.asText().isBlank();
    }

    private static boolean wholeNumber(JsonNode node) {
        double value = node.asDouble();
        return node.isNumber() && Double.isFinite(value) && value == Math.rint(value);
    }

    private static boolean optionalStrings(JsonNode node, String... fields) {
        for (String field : fields) if (node.has(field) && !node.path(field).isTextual()) return false;
        return true;
    }

    private static boolean stringList(JsonNode node) {
        if (!node.isArray()) return false;
        for (JsonNode item : node) if (!item.isTextual()) return false;
        return true;
    }
}
