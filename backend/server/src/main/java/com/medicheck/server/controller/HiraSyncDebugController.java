package com.medicheck.server.controller;

import com.medicheck.server.client.hira.HiraHospitalClient;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * HIRA API 디버그용 엔드포인트.
 * local 프로필에서만 활성화됩니다.
 */
@RestController
@RequestMapping("/api/hospitals")
@RequiredArgsConstructor
@Profile("local")
public class HiraSyncDebugController {

    private final HiraHospitalClient hiraHospitalClient;

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

