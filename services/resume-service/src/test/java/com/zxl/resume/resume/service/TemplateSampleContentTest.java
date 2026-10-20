package com.zxl.resume.resume.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class TemplateSampleContentTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final String valid = """
        {"version":1,"profile":{"key":"data-analyst","jobTitle":"数据分析师","experienceLevel":"1–3 年","highlights":["指标与实验"],"suggestedPages":2},"sections":[
          {"sectionType":"basic","sortOrder":0,"data":{"name":"示例","jobTitle":"数据分析师"}},
          {"sectionType":"experience","sortOrder":1,"layout":"right","data":{"items":[{"company":"示例公司","bullets":["分析业务数据"]}]}},
          {"sectionType":"custom","sortOrder":2,"data":{"content":"项目说明","_config":{"moduleName":"研究成果"}}}
        ]}
        """;

    @Test void parsesExactEditableDataAndManualColumn() throws Exception {
        var sections = TemplateSampleContent.parse(mapper, valid);
        assertEquals(3, sections.size());
        assertEquals("right", sections.get(1).layout());
        assertEquals("数据分析师", mapper.readTree(sections.get(0).data()).path("jobTitle").asText());
        assertEquals("研究成果", mapper.readTree(sections.get(2).data()).path("_config").path("moduleName").asText());
    }

    @Test void rejectsEntireMalformedSampleInsteadOfPartiallySeeding() {
        assertTrue(TemplateSampleContent.parse(mapper, valid.replace("\"custom\"", "\"unknown\"")).isEmpty());
        assertTrue(TemplateSampleContent.parse(mapper, valid.replace("\"data\":{\"content\":\"项目说明\",\"_config\":{\"moduleName\":\"研究成果\"}}", "\"data\":null")).isEmpty());
        assertTrue(TemplateSampleContent.parse(mapper, valid.replace("\"sortOrder\":2", "\"sortOrder\":1")).isEmpty());
        assertTrue(TemplateSampleContent.parse(mapper, valid.replace("\"layout\":\"right\"", "\"layout\":\"invalid\"")).isEmpty());
    }

    @Test void safelyRejectsLegacyOrUnsupportedPreviewFormats() {
        for (String input : new String[]{null, "", "{}", "[]", "not-json", valid.replace("\"version\":1", "\"version\":2"), valid.replace("\"basic\"", "\"summary\"")}) {
            assertTrue(TemplateSampleContent.parse(mapper, input).isEmpty());
        }
    }

    @Test void serializationIsDetachedFromEachParsingResult() throws Exception {
        var one = TemplateSampleContent.parse(mapper, valid);
        var edited = mapper.readTree(one.get(0).data());
        ((com.fasterxml.jackson.databind.node.ObjectNode) edited).put("name", "changed");
        assertEquals("示例", mapper.readTree(TemplateSampleContent.parse(mapper, valid).get(0).data()).path("name").asText());
    }
}
