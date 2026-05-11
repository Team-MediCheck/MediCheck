package com.medicheck.server.domain.hospital.controller;

import com.medicheck.server.domain.hospital.dto.SyncResult;
import com.medicheck.server.domain.hospital.dto.Top5BulkResult;
import com.medicheck.server.global.config.DirectionsRateLimitProperties;
import com.medicheck.server.global.auth.PerIPDirectionsRateLimitFilter;
import com.medicheck.server.global.auth.SecurityConfig;
import com.medicheck.server.global.auth.XAdminKeyAuthFilter;
import com.medicheck.server.domain.hospital.service.HiraSyncService;
import com.medicheck.server.domain.hospital.service.HospitalEvaluationSyncService;
import com.medicheck.server.domain.hospital.service.HospitalService;
import com.medicheck.server.domain.hospital.service.HospitalTop5SyncService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.times;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(HospitalController.class)
@Import({
    SecurityConfig.class,
    XAdminKeyAuthFilter.class,
    PerIPDirectionsRateLimitFilter.class,
    DirectionsRateLimitProperties.class,
    com.medicheck.server.global.auth.JwtAuthFilter.class,
    com.medicheck.server.global.auth.JwtService.class,
    com.medicheck.server.global.config.SecurityBeanConfig.class,
    com.medicheck.server.global.config.TestAuthConfig.class,
})
@TestPropertySource(properties = {
        "admin.sync-key=test-admin-key",
        "app.jwt.secret=abcdefghijklmnopqrstuvwxyz123456"
})
class HospitalControllerSyncSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private HospitalService hospitalService;

    @MockBean
    private HiraSyncService hiraSyncService;

    @MockBean
    private HospitalEvaluationSyncService hospitalEvaluationSyncService;

    @MockBean
    private HospitalTop5SyncService hospitalTop5SyncService;

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

        mockMvc.perform(post("/api/hospitals/sync/region")
                        .param("sidoCd", "470000")
                        .param("sgguCd", "471900")
                        .param("numOfRows", "10"))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/hospitals/sync/location")
                        .param("lat", "36.12")
                        .param("lng", "128.34")
                        .param("radiusMeters", "20000")
                        .param("numOfRows", "10"))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/hospitals/sync/evaluations"))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/hospitals/sync/evaluations/one").param("ykiho", "some-ykiho"))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/hospitals/sync/evaluations/region").param("addressKeyword", "구미"))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/hospitals/sync/full").param("numOfRows", "10"))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/hospitals/sync/top5/region").param("addressKeyword", "구미"))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/hospitals/sync/top5/one").param("ykiho", "x"))
                .andExpect(status().isForbidden());

        then(hiraSyncService).shouldHaveNoInteractions();
        then(hospitalEvaluationSyncService).shouldHaveNoInteractions();
    }

    @Test
    @DisplayName("동기화 엔드포인트는 올바른 관리자 키로만 호출할 수 있다")
    void syncEndpoints_allowedWithValidAdminKey() throws Exception {
        given(hiraSyncService.syncFromHira(anyInt(), anyInt()))
                .willReturn(SyncResult.builder().keyConfigured(true).fetchedCount(0).saved(0).build());
        given(hiraSyncService.syncAllRegions(anyInt()))
                .willReturn(SyncResult.builder().keyConfigured(true).fetchedCount(0).saved(0).build());
        given(hiraSyncService.syncRegion(anyString(), any(), anyInt()))
                .willReturn(SyncResult.builder().keyConfigured(true).fetchedCount(0).saved(0).build());
        given(hiraSyncService.syncByLocation(anyDouble(), anyDouble(), anyInt(), anyInt()))
                .willReturn(SyncResult.builder().keyConfigured(true).fetchedCount(0).saved(0).build());
        given(hospitalEvaluationSyncService.syncAll(any())).willReturn(0);
        given(hospitalEvaluationSyncService.syncOne(anyString())).willReturn(true);
        given(hospitalEvaluationSyncService.syncByAddressKeyword(anyString(), any())).willReturn(0);
        given(hospitalTop5SyncService.syncByAddressKeyword(anyString(), any())).willReturn(0);
        given(hospitalTop5SyncService.syncOne(anyString())).willReturn(false);
        given(hospitalTop5SyncService.syncAllByHospital(anyInt(), anyInt()))
                .willReturn(new Top5BulkResult(0, 0));

        mockMvc.perform(post("/api/hospitals/sync")
                        .header("X-Admin-Key", "test-admin-key")
                        .param("pageNo", "1")
                        .param("numOfRows", "10"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/hospitals/sync/all")
                        .header("X-Admin-Key", "test-admin-key")
                        .param("numOfRows", "10"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/hospitals/sync/region")
                        .header("X-Admin-Key", "test-admin-key")
                        .param("sidoCd", "470000")
                        .param("sgguCd", "471900")
                        .param("numOfRows", "10"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/hospitals/sync/location")
                        .header("X-Admin-Key", "test-admin-key")
                        .param("lat", "36.12")
                        .param("lng", "128.34")
                        .param("radiusMeters", "20000")
                        .param("numOfRows", "10"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/hospitals/sync/evaluations")
                        .header("X-Admin-Key", "test-admin-key"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/hospitals/sync/evaluations/one")
                        .header("X-Admin-Key", "test-admin-key")
                        .param("ykiho", "some-ykiho"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/hospitals/sync/evaluations/region")
                        .header("X-Admin-Key", "test-admin-key")
                        .param("addressKeyword", "구미"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/hospitals/sync/full")
                        .header("X-Admin-Key", "test-admin-key")
                        .param("numOfRows", "10"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/hospitals/sync/top5/region")
                        .header("X-Admin-Key", "test-admin-key")
                        .param("addressKeyword", "구미"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/hospitals/sync/top5/one")
                        .header("X-Admin-Key", "test-admin-key")
                        .param("ykiho", "some-ykiho"))
                .andExpect(status().isOk());

        then(hiraSyncService).should().syncFromHira(1, 10);
        then(hiraSyncService).should(times(2)).syncAllRegions(10);
        then(hiraSyncService).should().syncRegion("470000", "471900", 10);
        then(hiraSyncService).should().syncByLocation(36.12, 128.34, 20000, 10);
        then(hospitalEvaluationSyncService).should(times(2)).syncAll(any());
        then(hospitalEvaluationSyncService).should().syncOne("some-ykiho");
        then(hospitalEvaluationSyncService).should().syncByAddressKeyword("구미", null);
        then(hospitalTop5SyncService).should().syncAllByHospital(anyInt(), anyInt());
        then(hospitalTop5SyncService).should().syncByAddressKeyword("구미", null);
        then(hospitalTop5SyncService).should().syncOne("some-ykiho");
    }
}

