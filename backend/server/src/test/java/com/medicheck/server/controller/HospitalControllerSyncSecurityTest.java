package com.medicheck.server.controller;

import com.medicheck.server.dto.SyncResult;
import com.medicheck.server.security.SecurityConfig;
import com.medicheck.server.security.XAdminKeyAuthFilter;
import com.medicheck.server.service.HiraSyncService;
import com.medicheck.server.service.HospitalService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(HospitalController.class)
@Import({SecurityConfig.class, XAdminKeyAuthFilter.class})
@TestPropertySource(properties = "admin.sync-key=test-admin-key")
class HospitalControllerSyncSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private HospitalService hospitalService;

    @MockBean
    private HiraSyncService hiraSyncService;

    @Test
    @DisplayName("동기화 엔드포인트는 관리자 키 없이 접근 시 403을 반환한다")
    void syncEndpoints_forbiddenWithoutAdminKey() throws Exception {
        mockMvc.perform(post("/api/hospitals/sync")
                        .param("pageNo", "1")
                        .param("numOfRows", "10"))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/hospitals/sync/all")
                        .param("numOfRows", "10"))
                .andExpect(status().isForbidden());

        then(hiraSyncService).shouldHaveNoInteractions();
    }

    @Test
    @DisplayName("동기화 엔드포인트는 올바른 관리자 키로만 호출할 수 있다")
    void syncEndpoints_allowedWithValidAdminKey() throws Exception {
        given(hiraSyncService.syncFromHira(anyInt(), anyInt()))
                .willReturn(SyncResult.builder().keyConfigured(true).fetchedCount(0).saved(0).build());
        given(hiraSyncService.syncAllRegions(anyInt()))
                .willReturn(SyncResult.builder().keyConfigured(true).fetchedCount(0).saved(0).build());

        mockMvc.perform(post("/api/hospitals/sync")
                        .header("X-Admin-Key", "test-admin-key")
                        .param("pageNo", "1")
                        .param("numOfRows", "10"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/hospitals/sync/all")
                        .header("X-Admin-Key", "test-admin-key")
                        .param("numOfRows", "10"))
                .andExpect(status().isOk());

        then(hiraSyncService).should().syncFromHira(1, 10);
        then(hiraSyncService).should().syncAllRegions(10);
    }
}

