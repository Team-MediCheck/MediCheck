package com.medicheck.server.dto;

import com.medicheck.server.domain.entity.Hospital;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 병원 목록/상세 API 응답 DTO.
 */
@Getter
@Builder
public class HospitalResponse {

    private Long id;
    private String name;
    private String address;
    private BigDecimal latitude;
    private BigDecimal longitude;
    private String phone;
    private String publicCode;
    private String department;
    private Integer doctorTotalCount;
    private LocalDate establishedDate;
    private Integer mdeptSpecialistCount;
    private Integer mdeptGeneralCount;
    private Integer mdeptInternCount;
    private Integer mdeptResidentCount;
    private Integer detySpecialistCount;
    private Integer cmdcSpecialistCount;

    public static HospitalResponse from(Hospital hospital) {
        return HospitalResponse.builder()
                .id(hospital.getId())
                .name(hospital.getName())
                .address(hospital.getAddress())
                .latitude(hospital.getLatitude())
                .longitude(hospital.getLongitude())
                .phone(hospital.getPhone())
                .publicCode(hospital.getPublicCode())
                .department(hospital.getDepartment())
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
