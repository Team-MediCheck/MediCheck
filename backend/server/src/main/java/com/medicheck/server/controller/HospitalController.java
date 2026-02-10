package com.medicheck.server.controller;

import com.medicheck.server.dto.HospitalResponse;
import com.medicheck.server.service.HospitalService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 안심 병원 API.
 */
@RestController
@RequestMapping("/api/hospitals")
@RequiredArgsConstructor
public class HospitalController {

    private final HospitalService hospitalService;

    /**
     * 병원 목록 조회.
     * GET /api/hospitals
     */
    @GetMapping
    public ResponseEntity<List<HospitalResponse>> getHospitals() {
        List<HospitalResponse> list = hospitalService.findAll();
        return ResponseEntity.ok(list);
    }
}
