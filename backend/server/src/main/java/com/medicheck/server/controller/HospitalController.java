package com.medicheck.server.controller;

import com.medicheck.server.client.hira.HiraHospitalClient;
import lombok.extern.slf4j.Slf4j;
import com.medicheck.server.dto.HospitalResponse;
import com.medicheck.server.dto.SyncResult;
import com.medicheck.server.service.HiraSyncService;
import com.medicheck.server.service.HospitalService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 안심 병원 API.
 */
@RestController
@RequestMapping("/api/hospitals")
@RequiredArgsConstructor
@Slf4j
public class HospitalController {

    private final HospitalService hospitalService;
    private final HiraSyncService hiraSyncService;
    private final HiraHospitalClient hiraHospitalClient;

    /**
     * 병원 목록 조회 (페이지네이션).
     * GET /api/hospitals?page=0&size=20
     */
    @GetMapping
    public ResponseEntity<Page<HospitalResponse>> getHospitals(
            @PageableDefault(size = 20) Pageable pageable
    ) {
        Page<HospitalResponse> page = hospitalService.findAll(pageable);
        return ResponseEntity.ok(page);
    }

    /**
     * HIRA 병원정보 Open API에서 데이터를 가져와 DB에 동기화합니다.
     * local 프로필 사용 시 application-local.yaml 의 인증키가 적용됩니다.
     * POST /api/hospitals/sync?pageNo=1&numOfRows=100
     */
    @PostMapping("/sync")
    public ResponseEntity<?> syncFromHira(
            @RequestParam(defaultValue = "1") int pageNo,
            @RequestParam(defaultValue = "100") int numOfRows
    ) {
        try {
            SyncResult result = hiraSyncService.syncFromHira(pageNo, numOfRows);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            // 민감한 예외 정보는 로그에만 남기고, 클라이언트에는 에러 ID만 노출
            String errorId = java.util.UUID.randomUUID().toString();
            log.error("HIRA 동기화 실패 errorId={}", errorId, e);
            return ResponseEntity.status(500).body(Map.of(
                    "error", "sync failed",
                    "message", "internal server error",
                    "errorId", errorId
            ));
        }
    }

    /**
     * HIRA API 원문 응답 확인 (디버그용). GET /api/hospitals/sync/debug
     */
    @GetMapping("/sync/debug")
    public ResponseEntity<Map<String, Object>> syncDebug(
            @RequestParam(defaultValue = "1") int pageNo,
            @RequestParam(defaultValue = "10") int numOfRows
    ) {
        HiraHospitalClient.RawResponseResult r = hiraHospitalClient.getRawResponse(pageNo, numOfRows);
        return ResponseEntity.ok(Map.of(
                "keyConfigured", r.keyConfigured(),
                "rawResponse", r.rawResponse() != null ? r.rawResponse() : "",
                "error", r.error() != null ? r.error() : ""
        ));
    }
}
