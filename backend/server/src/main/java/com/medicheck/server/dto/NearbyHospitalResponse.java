package com.medicheck.server.dto;

import com.medicheck.server.domain.entity.Hospital;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 근처 병원 API 응답 DTO. 기본 병원 정보 + 사용자 위치 기준 거리(m).
 */
@Getter
@Builder
public class NearbyHospitalResponse {

    private Long id;
    private String name;
    private String address;
    private BigDecimal latitude;
    private BigDecimal longitude;
    private String phone;
    private String publicCode;
    private String department;
    /** 사용자 위치에서의 거리 (미터) */
    private Double distanceMeters;
    private Integer doctorTotalCount;
    private LocalDate establishedDate;
    private Integer mdeptSpecialistCount;
    private Integer mdeptGeneralCount;
    private Integer mdeptInternCount;
    private Integer mdeptResidentCount;
    private Integer detySpecialistCount;
    private Integer cmdcSpecialistCount;

    public static NearbyHospitalResponse from(Hospital hospital, double distanceMeters) {
        return NearbyHospitalResponse.builder()
                .id(hospital.getId())
                .name(hospital.getName())
                .address(hospital.getAddress())
                .latitude(hospital.getLatitude())
                .longitude(hospital.getLongitude())
                .phone(hospital.getPhone())
                .publicCode(hospital.getPublicCode())
                .department(hospital.getDepartment())
                .distanceMeters(distanceMeters)
                .doctorTotalCount(hospital.getDoctorTotalCount())
                .establishedDate(hospital.getEstablishedDate())
                .mdeptSpecialistCount(hospital.getMdeptSpecialistCount())
                .mdeptGeneralCount(hospital.getMdeptGeneralCount())
                .mdeptInternCount(hospital.getMdeptInternCount())
                .mdeptResidentCount(hospital.getMdeptResidentCount())
                .detySpecialistCount(hospital.getDetySpecialistCount())
                .cmdcSpecialistCount(hospital.getCmdcSpecialistCount())
                .build();
    }
}
