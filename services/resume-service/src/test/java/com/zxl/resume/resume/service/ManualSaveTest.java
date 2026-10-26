package com.zxl.resume.resume.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.zxl.resume.resume.dto.*;
import com.zxl.resume.resume.entity.*;
import com.zxl.resume.resume.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.server.ResponseStatusException;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ManualSaveTest {
    final ResumeMapper resumes = mock(ResumeMapper.class);
    final SectionMapper sections = mock(SectionMapper.class);
    final ResumeVersionMapper versions = mock(ResumeVersionMapper.class);
    final ObjectMapper json = new ObjectMapper().findAndRegisterModules();
    final ResumeService service = new ResumeService(resumes, sections, versions, mock(TemplateCategoryMapper.class), json);
    final UUID id = UUID.randomUUID(), owner = UUID.randomUUID();
    Resume resume;
    @BeforeEach void setup() {
        resume = new Resume(); resume.setId(id); resume.setUserId(owner); resume.setTitle("Before");
        resume.setUpdatedAt(Instant.parse("2026-01-01T00:00:00Z"));
        resume.setShareEnabled(true); resume.setShareToken("private-token"); resume.setViewCount(9);
        when(resumes.findByIdForUpdate(id)).thenReturn(resume);
        when(resumes.selectById(id)).thenReturn(resume);
        when(sections.findByResumeIdOrdered(id)).thenReturn(List.of());
        when(versions.findByResumeId(id)).thenReturn(List.of());
    }
    SaveResumeContentRequest request() throws Exception {
        return json.readValue("""
            {"title":"After","fontFamily":"system-ui","fontSize":14,"themeColor":"#123456",
             "lineSpacing":1.5,"layoutConfig":"{}","sections":[],"expectedUpdatedAt":"2026-01-01T00:00:00Z"}
            """, SaveResumeContentRequest.class);
    }
    @Test void savesBaselineAndResultAndPreservesSharing() throws Exception {
        var result = service.saveContent(id, owner, request());
        var saved = ArgumentCaptor.forClass(ResumeVersion.class);
        verify(versions, times(2)).insert(saved.capture());
        assertEquals("Before", json.readTree(saved.getAllValues().get(0).getSnapshot()).path("title").asText());
        assertEquals("After", json.readTree(saved.getAllValues().get(1).getSnapshot()).path("title").asText());
        assertEquals(1, saved.getAllValues().get(0).getVersionNum());
        assertEquals(2, saved.getAllValues().get(1).getVersionNum());
        assertEquals("private-token", result.getShareToken()); assertEquals(9, result.getViewCount());
        verify(sections).deleteByResumeId(id);
    }
    @Test void staleSaveCannotWriteAnything() throws Exception {
        var req = request(); req.setExpectedUpdatedAt(Instant.EPOCH);
        assertEquals(409, assertThrows(ResponseStatusException.class, () -> service.saveContent(id, owner, req)).getStatusCode().value());
        verifyNoInteractions(versions); verify(sections, never()).deleteByResumeId(any());
        verify(resumes, never()).replaceContent(any());
    }
    @Test void rejectsForeignSectionBeforeWrites() throws Exception {
        var req = request(); var section = new SaveResumeContentRequest.Section();
        section.setId(UUID.randomUUID()); section.setSectionType("summary"); section.setSortOrder(0);
        section.setIsVisible(true); section.setLayout("single-column"); section.setData(json.readTree("{}"));
        req.setSections(List.of(section));
        var foreign = new ResumeSection(); foreign.setResumeId(UUID.randomUUID());
        when(sections.selectById(section.getId())).thenReturn(foreign);
        assertThrows(IllegalArgumentException.class, () -> service.saveContent(id, owner, req));
        verifyNoInteractions(versions); verify(sections, never()).deleteByResumeId(any());
    }
    @Test void versionDetailChecksMembershipAndSanitizesLegacyData() throws Exception {
        var v = new ResumeVersion(); v.setId(UUID.randomUUID()); v.setResumeId(id); v.setVersionNum(1);
        v.setSnapshot("{\"title\":\"Old\",\"sections\":[{\"sectionType\":\"summary\",\"data\":\"{\\\"content\\\":\\\"old\\\"}\"},{\"data\":false}]}");
        when(versions.selectById(v.getId())).thenReturn(v);
        var detail = service.getVersionDetail(id, owner, v.getId());
        assertEquals("Old", detail.getSnapshot().getTitle());
        assertEquals("old", json.valueToTree(detail.getSnapshot().getSections().get(0).getData()).path("content").asText());
        assertTrue(json.valueToTree(detail.getSnapshot().getSections().get(1).getData()).isObject());
        v.setResumeId(UUID.randomUUID());
        assertThrows(IllegalArgumentException.class, () -> service.getVersionDetail(id, owner, v.getId()));
    }
    @Test void latestMatchingSnapshotAvoidsRedundantBaseline() throws Exception {
        var prior = new ResumeVersion(); prior.setVersionNum(7);
        prior.setSnapshot(json.writeValueAsString(service.getDetail(id, owner)));
        when(versions.findByResumeId(id)).thenReturn(List.of(prior));
        service.saveContent(id, owner, request());
        var saved = ArgumentCaptor.forClass(ResumeVersion.class); verify(versions).insert(saved.capture());
        assertEquals(8, saved.getValue().getVersionNum());
    }

    @Test void invalidObjectsAndOversizedPayloadsAreRejectedBeforeDatabaseAccess() throws Exception {
        var badLayout = request(); badLayout.setLayoutConfig("[]");
        assertThrows(IllegalArgumentException.class, () -> service.saveContent(id, owner, badLayout));
        var longLabel = request(); longLabel.setLabel("x".repeat(101));
        assertThrows(IllegalArgumentException.class, () -> service.saveContent(id, owner, longLabel));
        var invalid = request(); var s = new SaveResumeContentRequest.Section();
        s.setId(UUID.randomUUID()); s.setSectionType("summary"); s.setSortOrder(0); s.setIsVisible(true); s.setLayout("single-column");
        s.setData(json.readTree("[]")); invalid.setSections(List.of(s));
        assertThrows(IllegalArgumentException.class, () -> service.saveContent(id, owner, invalid));
        s.setData(json.createObjectNode().put("content", "x".repeat(262145)));
        assertThrows(IllegalArgumentException.class, () -> service.saveContent(id, owner, invalid));
        verifyNoInteractions(resumes, sections, versions);
    }

    @Test void foreignOwnerCannotSaveOrReadSnapshot() throws Exception {
        var req = request(); UUID foreign = UUID.randomUUID();
        assertThrows(IllegalArgumentException.class, () -> service.saveContent(id, foreign, req));
        assertThrows(IllegalArgumentException.class, () -> service.getVersionDetail(id, foreign, UUID.randomUUID()));
        verifyNoInteractions(versions, sections);
    }

    @Test void malformedLegacySnapshotReturnsControlledError() {
        var v = new ResumeVersion(); v.setId(UUID.randomUUID()); v.setResumeId(id); v.setSnapshot("{broken");
        when(versions.selectById(v.getId())).thenReturn(v);
        assertEquals(422, assertThrows(ResponseStatusException.class, () -> service.getVersionDetail(id, owner, v.getId())).getStatusCode().value());
    }

    @Test void legacyMalformedMetadataReceivesEditableDefaults() {
        var v = new ResumeVersion(); v.setId(UUID.randomUUID()); v.setResumeId(id);
        v.setSnapshot("{\"id\":\"invalid\",\"title\":null,\"templateId\":\"bad\",\"fontSize\":999,\"lineSpacing\":-1,\"layoutConfig\":{\"layout\":\"two-column\"},\"sections\":[{\"sectionType\":\"\",\"sortOrder\":-5,\"data\":null}]}");
        when(versions.selectById(v.getId())).thenReturn(v);
        var detail = service.getVersionDetail(id, owner, v.getId()).getSnapshot();
        assertEquals(id, detail.getId()); assertEquals("历史简历", detail.getTitle()); assertNull(detail.getTemplateId());
        assertEquals(14, detail.getFontSize()); assertEquals(1.6, detail.getLineSpacing());
        assertEquals("{\"layout\":\"two-column\"}", detail.getLayoutConfig());
        assertEquals("custom", detail.getSections().get(0).getSectionType());
        assertEquals(0, detail.getSections().get(0).getSortOrder());
    }

    @Test void unknownProtectedFieldsCannotBeAccepted() {
        assertThrows(com.fasterxml.jackson.databind.JsonMappingException.class,
                () -> json.readValue("{\"title\":\"x\",\"shareEnabled\":true}", SaveResumeContentRequest.class));
    }

    @Test void replacesAllSectionsIncludingLocalIdsVisibilityOrderAndData() throws Exception {
        var req = request(); var input = new SaveResumeContentRequest.Section();
        input.setId(UUID.randomUUID()); input.setSectionType("summary"); input.setSortOrder(4);
        input.setIsVisible(false); input.setLayout("left"); input.setData(json.readTree("{\"content\":\"New text\"}"));
        req.setSections(List.of(input));
        var existing = new ResumeSection(); existing.setId(UUID.randomUUID()); existing.setData("{\"content\":\"Old text\"}");
        var persisted = new ResumeSection(); persisted.setId(input.getId()); persisted.setData(input.getData().toString());
        persisted.setSectionType("summary"); persisted.setSortOrder(4); persisted.setIsVisible(false); persisted.setLayout("left");
        when(sections.findByResumeIdOrdered(id)).thenReturn(List.of(existing), List.of(persisted));
        var result = service.saveContent(id, owner, req);
        var inserted = ArgumentCaptor.forClass(ResumeSection.class); verify(sections).insert(inserted.capture());
        assertEquals(input.getId(), inserted.getValue().getId()); assertEquals(id, inserted.getValue().getResumeId());
        assertEquals(input.getData().toString(), inserted.getValue().getData());
        assertEquals(4, result.getSections().get(0).getSortOrder());
        assertFalse(result.getSections().get(0).getIsVisible()); assertEquals("left", result.getSections().get(0).getLayout());
        var order = inOrder(sections); order.verify(sections).deleteByResumeId(id); order.verify(sections).insert(any(ResumeSection.class));
        var snapshots = ArgumentCaptor.forClass(ResumeVersion.class); verify(versions, times(2)).insert(snapshots.capture());
        assertEquals("Old text", json.readTree(snapshots.getAllValues().get(0).getSnapshot()).path("sections").get(0).path("data").path("content").asText());
        assertEquals("New text", json.readTree(snapshots.getAllValues().get(1).getSnapshot()).path("sections").get(0).path("data").path("content").asText());
    }

    @Test void legacySectionMutationLocksAndInvalidatesParentSaveToken() {
        UUID sectionId = UUID.randomUUID(); var section = new ResumeSection(); section.setId(sectionId); section.setResumeId(id);
        when(sections.selectById(sectionId)).thenReturn(section);
        service.toggleSectionVisibility(sectionId, owner);
        var order = inOrder(resumes, sections);
        order.verify(sections).selectById(sectionId);
        order.verify(resumes).findByIdForUpdate(id);
        order.verify(sections).selectById(sectionId);
        order.verify(sections).updateById(section);
        order.verify(resumes).touchContent(id);
    }

    @Test void legacyMutationRejectsSectionReassignedWhileWaitingForLock() {
        UUID sectionId = UUID.randomUUID(); var section = new ResumeSection(); section.setId(sectionId); section.setResumeId(id);
        var foreign = new ResumeSection(); foreign.setId(sectionId); foreign.setResumeId(UUID.randomUUID());
        when(sections.selectById(sectionId)).thenReturn(section, foreign);
        assertThrows(IllegalArgumentException.class, () -> service.toggleSectionVisibility(sectionId, owner));
        verify(sections, never()).updateById(any(ResumeSection.class));
    }
}
