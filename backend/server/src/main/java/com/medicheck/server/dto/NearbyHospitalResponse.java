package com.medicheck.server.dto;

import com.medicheck.server.domain.entity.Hospital;
import lombok.Builder;
import lombok.Getter;

/**
 * 근처 병원 API 응답 DTO. 병원 상세 정보 + 사용자 위치 기준 거리(m).
 */
@Getter
@Builder
public class NearbyHospitalResponse {

    private final HospitalResponse hospital;
    /** 사용자 위치에서의 거리 (미터) */
    private final Double distanceMeters;

    public static NearbyHospitalResponse from(Hospital hospital, double distanceMeters) {
        return NearbyHospitalResponse.builder()
                .hospital(HospitalResponse.from(hospital))
                .distanceMeters(distanceMeters)
                .build();
    }
}
