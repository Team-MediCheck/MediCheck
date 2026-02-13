package com.medicheck.server.controller;

import lombok.extern.slf4j.Slf4j;
import com.medicheck.server.dto.HospitalResponse;
import com.medicheck.server.dto.NearbyHospitalResponse;
import com.medicheck.server.dto.SyncResult;
import com.medicheck.server.service.HiraSyncService;
import com.medicheck.server.service.HospitalService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;
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

    /**
     * 관리용 동기화 엔드포인트 보호용 토큰.
     * application[-local].yaml 의 admin.sync-key 또는 환경변수 ADMIN_SYNC_KEY 로 설정.
     */
    @Value("${admin.sync-key:${ADMIN_SYNC_KEY:}}")
    private String adminSyncKey;

    /**
     * 병원 목록 조회 (검색/필터/정렬/페이지네이션).
     * GET /api/hospitals?page=0&size=20&keyword=검색어&department=내과&sort=name,asc
     */
    /**
     * 병원 상세 조회.
     * GET /api/hospitals/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<HospitalResponse> getHospital(@PathVariable Long id) {
        return hospitalService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping
    public ResponseEntity<Page<HospitalResponse>> getHospitals(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String department,
            @PageableDefault(size = 20, sort = "name") Pageable pageable
    ) {
        Page<HospitalResponse> page = hospitalService.findAll(keyword, department, pageable);
        return ResponseEntity.ok(page);
    }

    /**
     * 근처 병원 조회.
     * 사용자의 위치(lat, lng)에서 반경(radiusMeters m) 내 병원을 거리 오름차순으로 반환합니다.
     * 각 항목에 distanceMeters(미터)가 포함됩니다.
     *
     * 예: GET /api/hospitals/nearby?lat=37.5665&lng=126.9780&radiusMeters=3000
     */
    @GetMapping("/nearby")
    public ResponseEntity<List<NearbyHospitalResponse>> getNearbyHospitals(
            @RequestParam("lat") BigDecimal latitude,
            @RequestParam("lng") BigDecimal longitude,
            @RequestParam(name = "radiusMeters", defaultValue = "3000") double radiusMeters
    ) {
        List<NearbyHospitalResponse> hospitals = hospitalService.findNearby(latitude, longitude, radiusMeters);
        return ResponseEntity.ok(hospitals);
    }

    /**
     * HIRA 병원정보 Open API에서 데이터를 가져와 DB에 동기화합니다.
     * local 프로필 사용 시 application-local.yaml 의 인증키가 적용됩니다.
     * POST /api/hospitals/sync?pageNo=1&numOfRows=100
     */
    @PostMapping("/sync")
    public ResponseEntity<?> syncFromHira(
            @RequestHeader(name = "X-Admin-Key", required = false) String adminKey,
            @RequestParam(defaultValue = "1") int pageNo,
            @RequestParam(defaultValue = "100") int numOfRows
    ) {
        if (!isAdmin(adminKey)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "error", "forbidden",
                    "message", "admin access required for sync"
            ));
        }
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
     * 전국 시·도 병원 정보를 HIRA에서 조회해 DB에 동기화합니다.
     * 페이지 수는 HIRA 응답이 끝날 때까지 자동으로 순회합니다.
     * POST /api/hospitals/sync/all?numOfRows=500
     */
    @PostMapping("/sync/all")
    public ResponseEntity<?> syncAllFromHira(
            @RequestHeader(name = "X-Admin-Key", required = false) String adminKey,
            @RequestParam(defaultValue = "500") int numOfRows
    ) {
        if (!isAdmin(adminKey)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "error", "forbidden",
                    "message", "admin access required for sync-all"
            ));
        }
        try {
            SyncResult result = hiraSyncService.syncAllRegions(numOfRows);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            String errorId = java.util.UUID.randomUUID().toString();
            log.error("HIRA 전국 동기화 실패 errorId={}", errorId, e);
            return ResponseEntity.status(500).body(Map.of(
                    "error", "sync-all failed",
                    "message", "internal server error",
                    "errorId", errorId
            ));
        }
    }

    private boolean isAdmin(String adminKey) {
        if (adminSyncKey == null || adminSyncKey.isBlank()) {
            log.error(
                    "admin.sync-key(또는 ADMIN_SYNC_KEY)가 비어 있어 동기화 API 접근을 거부합니다. "
                            + "프로덕션에서는 반드시 비어 있지 않은 값으로 설정해야 합니다."
            );
            return false;
        }
        return adminKey != null && adminSyncKey.equals(adminKey);
    }

}
