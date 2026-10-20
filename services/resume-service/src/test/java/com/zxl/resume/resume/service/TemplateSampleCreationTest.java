package com.zxl.resume.resume.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.zxl.resume.resume.dto.CreateResumeRequest;
import com.zxl.resume.resume.entity.ResumeSection;
import com.zxl.resume.resume.repository.*;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import java.util.HashSet;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class TemplateSampleCreationTest {
    private final ResumeMapper resumes = mock(ResumeMapper.class);
    private final SectionMapper sections = mock(SectionMapper.class);
    private final TemplateCategoryMapper templates = mock(TemplateCategoryMapper.class);
    private final ObjectMapper json = new ObjectMapper();
    private final ResumeService service = new ResumeService(resumes, sections, mock(ResumeVersionMapper.class), templates, json);
    private final UUID templateId = UUID.randomUUID();
    private final String sample = """
        {"version":1,"profile":{"key":"data-analyst","jobTitle":"数据分析师","experienceLevel":"1–3 年","highlights":["指标与实验"],"suggestedPages":2},"sections":[
          {"sectionType":"basic","sortOrder":0,"data":{"name":"示例","jobTitle":"数据分析师"}},
          {"sectionType":"projects","sortOrder":1,"layout":"left","data":{"items":[{"name":"指标体系","bullets":["统一业务口径"]}]}}
        ]}
        """;

    private CreateResumeRequest request() {
        var request = new CreateResumeRequest();
        request.setTitle("测试简历");
        request.setTemplateId(templateId);
        return request;
    }

    @Test void copiesTemplateContentWithIndependentResumeAndSectionIds() throws Exception {
        when(templates.findPreviewById(templateId)).thenReturn(sample);
        when(templates.findConfigById(templateId)).thenReturn("{\"layout\":\"two-column\",\"globalFontSize\":12.5,\"globalLineSpacing\":1.5,\"moduleMargin\":12}");
        var first = service.create(UUID.randomUUID(), request());
        var second = service.create(UUID.randomUUID(), request());
        var saved = ArgumentCaptor.forClass(ResumeSection.class);
        verify(sections, times(4)).insert(saved.capture());
        var records = saved.getAllValues();
        assertNotEquals(first.getId(), second.getId());
        assertEquals(4, new HashSet<>(records.stream().map(ResumeSection::getId).toList()).size());
        assertEquals(first.getId(), records.get(0).getResumeId());
        assertEquals(second.getId(), records.get(2).getResumeId());
        assertEquals("数据分析师", json.readTree(records.get(0).getData()).path("jobTitle").asText());
        assertEquals(records.get(0).getData(), records.get(2).getData());
        assertEquals("left", records.get(1).getLayout());
        assertEquals(12.5, json.readTree(first.getLayoutConfig()).path("globalFontSize").asDouble());
        assertEquals(1.5, first.getLineSpacing());
        verify(templates, never()).findCategoryById(any());
    }

    @Test void invalidSampleSeedsOnlyTheLegacyFallbackWithoutPartialContent() throws Exception {
        when(templates.findPreviewById(templateId)).thenReturn(sample.replace("\"projects\"", "\"unknown\""));
        when(templates.findCategoryById(templateId)).thenReturn("general");
        service.create(UUID.randomUUID(), request());
        var saved = ArgumentCaptor.forClass(ResumeSection.class);
        verify(sections, times(6)).insert(saved.capture());
        assertEquals("林予安", json.readTree(saved.getAllValues().get(0).getData()).path("name").asText());
    }

    @Test void invalidTemplateSizingCannotOverrideSafeDefaults() throws Exception {
        when(templates.findPreviewById(templateId)).thenReturn(sample);
        when(templates.findConfigById(templateId)).thenReturn("{\"globalFontSize\":-1,\"globalLineSpacing\":100,\"pageTopMargin\":-20}");
        var created = service.create(UUID.randomUUID(), request());
        assertEquals(14, created.getFontSize());
        assertEquals(1.6, created.getLineSpacing());
        assertFalse(json.readTree(created.getLayoutConfig()).has("pageTopMargin"));
    }
}
