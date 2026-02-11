package com.medicheck.server.service;

import com.medicheck.server.domain.entity.Hospital;
import com.medicheck.server.domain.repository.HospitalRepository;
import com.medicheck.server.domain.repository.HospitalSpecification;
import com.medicheck.server.dto.HospitalResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 안심 병원 조회 서비스.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class HospitalService {

    private final HospitalRepository hospitalRepository;

    /**
     * 등록된 병원 목록을 페이지 단위로 조회합니다.
     * 검색(keyword), 필터(department), 정렬(sort)을 지원합니다.
     *
     * @param keyword   병원명/주소/진료과 통합 검색 (없으면 무시)
     * @param department 진료과 필터 (없으면 무시)
     * @param pageable  page, size, sort (예: sort=name,asc / sort=createdAt,desc)
     */
    public Page<HospitalResponse> findAll(String keyword, String department, Pageable pageable) {
        Specification<Hospital> spec =
                HospitalSpecification.withFilters(keyword, department);
        return hospitalRepository.findAll(spec, pageable).map(HospitalResponse::from);
    }

    /**
     * 사용자의 위치 기준 반경(radiusMeters m) 내 병원을 거리순으로 조회합니다.
     *
     * @param latitude     사용자 위도 (WGS84)
     * @param longitude    사용자 경도 (WGS84)
     * @param radiusMeters 반경 (미터)
     */
    public List<HospitalResponse> findNearby(BigDecimal latitude, BigDecimal longitude, double radiusMeters) {
        if (latitude == null || longitude == null) {
            throw new IllegalArgumentException("latitude and longitude must not be null");
        }
        if (radiusMeters <= 0) {
            throw new IllegalArgumentException("radiusMeters must be greater than 0");
        }

        List<Hospital> hospitals = hospitalRepository.findNearby(
                latitude.doubleValue(),
                longitude.doubleValue(),
                radiusMeters
        );

        return hospitals.stream()
                .map(HospitalResponse::from)
                .collect(Collectors.toList());
    }
}
