package com.medicheck.server.service;

import com.medicheck.server.domain.repository.HospitalRepository;
import com.medicheck.server.dto.HospitalResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 안심 병원 조회 서비스.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class HospitalService {

    private final HospitalRepository hospitalRepository;

    /**
     * 등록된 병원 목록을 조회합니다.
     */
    public List<HospitalResponse> findAll() {
        return hospitalRepository.findAll().stream()
                .map(HospitalResponse::from)
                .toList();
    }
}
