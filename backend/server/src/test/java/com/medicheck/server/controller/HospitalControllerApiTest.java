package com.medicheck.server.controller;

import com.medicheck.server.dto.HospitalResponse;
import com.medicheck.server.security.SecurityConfig;
import com.medicheck.server.security.XAdminKeyAuthFilter;
import com.medicheck.server.dto.NearbyHospitalResponse;
import com.medicheck.server.service.HospitalService;
import com.medicheck.server.service.HiraSyncService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(HospitalController.class)
@Import({SecurityConfig.class, XAdminKeyAuthFilter.class})
@TestPropertySource(properties = "admin.sync-key=test-admin-key")
class HospitalControllerApiTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private HospitalService hospitalService;

    @MockBean
    private HiraSyncService hiraSyncService;

    @Test
    @DisplayName("GET /api/hospitals/{id} - 존재하는 병원은 200과 상세 정보를 반환한다")
    void getHospital_returns200AndBody() throws Exception {
        HospitalResponse response = HospitalResponse.builder()
                .id(1L)
                .name("테스트병원")
                .address("서울시 강남구")
                .latitude(BigDecimal.valueOf(37.5))
                .longitude(BigDecimal.valueOf(127.0))
                .phone("02-1234-5678")
                .publicCode("PUB001")
                .department("내과")
                .doctorTotalCount(5)
                .build();
        given(hospitalService.findById(1L)).willReturn(Optional.of(response));

        mockMvc.perform(get("/api/hospitals/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.name").value("테스트병원"))
                .andExpect(jsonPath("$.department").value("내과"))
                .andExpect(jsonPath("$.doctorTotalCount").value(5));
    }

    @Test
    @DisplayName("GET /api/hospitals/{id} - 존재하지 않는 병원은 404를 반환한다")
    void getHospital_returns404WhenNotFound() throws Exception {
        given(hospitalService.findById(999L)).willReturn(Optional.empty());

        mockMvc.perform(get("/api/hospitals/999"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("GET /api/hospitals - 목록 조회 시 200과 페이지 결과를 반환한다")
    void getHospitals_returns200AndPage() throws Exception {
        HospitalResponse item = HospitalResponse.builder()
                .id(1L)
                .name("목록병원")
                .address("서울")
                .department("외과")
                .build();
        Page<HospitalResponse> page = new PageImpl<>(List.of(item), PageRequest.of(0, 20), 1);
        given(hospitalService.findAll(any(), any(), any())).willReturn(page);

        mockMvc.perform(get("/api/hospitals")
                        .param("page", "0")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.content[0].id").value(1))
                .andExpect(jsonPath("$.content[0].name").value("목록병원"))
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    @DisplayName("GET /api/hospitals/nearby - 근처 병원 조회 시 200과 hospital, distanceMeters를 반환한다")
    void getNearbyHospitals_returns200AndList() throws Exception {
        HospitalResponse hospital = HospitalResponse.builder()
                .id(1L)
                .name("근처병원")
                .address("강남구")
                .latitude(BigDecimal.valueOf(37.5))
                .longitude(BigDecimal.valueOf(127.0))
                .build();
        NearbyHospitalResponse item = NearbyHospitalResponse.builder()
                .hospital(hospital)
                .distanceMeters(500.0)
                .build();
        given(hospitalService.findNearby(eq(BigDecimal.valueOf(37.5665)), eq(BigDecimal.valueOf(126.978)), eq(3000.0)))
                .willReturn(List.of(item));

        mockMvc.perform(get("/api/hospitals/nearby")
                        .param("lat", "37.5665")
                        .param("lng", "126.978")
                        .param("radiusMeters", "3000"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[0].hospital.id").value(1))
                .andExpect(jsonPath("$[0].hospital.name").value("근처병원"))
                .andExpect(jsonPath("$[0].distanceMeters").value(500.0));
    }

    @Test
    @DisplayName("GET /api/hospitals/nearby - lat/lng 없으면 400을 반환한다")
    void getNearbyHospitals_returns400WhenMissingParams() throws Exception {
        mockMvc.perform(get("/api/hospitals/nearby"))
                .andExpect(status().isBadRequest());
    }
}
