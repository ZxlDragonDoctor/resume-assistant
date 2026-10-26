package com.zxl.resume.resume.service;

import com.zxl.resume.common.annotation.UserId;
import com.zxl.resume.common.exception.GlobalExceptionHandler;
import com.zxl.resume.resume.controller.ResumeController;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpStatus;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.util.UUID;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ManualSaveEndpointTest {
    final ResumeService service = mock(ResumeService.class);
    final UUID id = UUID.randomUUID(), owner = UUID.randomUUID();
    MockMvc mvc;
    @BeforeEach void setup() {
        mvc = MockMvcBuilders.standaloneSetup(new ResumeController(service))
                .setControllerAdvice(new GlobalExceptionHandler())
                .setCustomArgumentResolvers(new HandlerMethodArgumentResolver() {
                    public boolean supportsParameter(MethodParameter parameter) { return parameter.hasParameterAnnotation(UserId.class); }
                    public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer container, NativeWebRequest request,
                                                  WebDataBinderFactory factory) { return owner; }
                }).build();
    }
    @Test void rejectsProtectedFieldsAs400() throws Exception {
        mvc.perform(put("/api/resumes/{id}/content", id).contentType("application/json")
                .content("{\"title\":\"x\",\"shareEnabled\":true}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value(400));
        verifyNoInteractions(service);
    }
    @Test void missingConcurrencyTokenIs400() throws Exception {
        mvc.perform(put("/api/resumes/{id}/content", id).contentType("application/json")
                .content("{\"title\":\"x\",\"fontFamily\":\"system-ui\",\"fontSize\":14,\"lineSpacing\":1.6,\"themeColor\":\"#123456\",\"layoutConfig\":\"{}\",\"sections\":[]}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }
    @Test void concurrencyConflictIs409Envelope() throws Exception {
        when(service.saveContent(eq(id), eq(owner), any())).thenThrow(new ResponseStatusException(HttpStatus.CONFLICT, "conflict"));
        mvc.perform(put("/api/resumes/{id}/content", id).contentType("application/json")
                .content("{\"title\":\"x\",\"fontFamily\":\"system-ui\",\"fontSize\":14,\"lineSpacing\":1.6,\"themeColor\":\"#123456\",\"layoutConfig\":\"{}\",\"sections\":[],\"expectedUpdatedAt\":\"2026-01-01T00:00:00Z\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value(409));
    }
}
