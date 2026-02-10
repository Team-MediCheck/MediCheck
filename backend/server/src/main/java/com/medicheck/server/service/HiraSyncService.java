package com.medicheck.server.service;

import com.medicheck.server.client.hira.HiraHospitalClient;
import com.medicheck.server.client.hira.dto.HiraHospItem;
import com.medicheck.server.config.HiraApiProperties;
import com.medicheck.server.domain.entity.Hospital;
import com.medicheck.server.domain.repository.HospitalRepository;
import com.medicheck.server.dto.SyncResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * HIRA 병원정보 Open API 데이터를 DB에 동기화하는 서비스.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class HiraSyncService {

    private final HiraHospitalClient hiraHospitalClient;
    private final HospitalRepository hospitalRepository;
    private final HiraApiProperties hiraApiProperties;

    /**
     * HIRA API에서 병원기본목록을 조회해 DB에 저장합니다.
     * 동일 publicCode(ykiho)가 있으면 건너뜁니다.
     *
     * @param pageNo    페이지 번호 (1부터)
     * @param numOfRows 한 페이지 결과 수 (최대 1000 등 API 제한 확인)
     * @return 동기화 결과 (인증키 여부, 조회 건수, 저장 건수)
     */
    @Transactional
    public SyncResult syncFromHira(int pageNo, int numOfRows) {
        boolean keyConfigured = hiraApiProperties.getServiceKey() != null
                && !hiraApiProperties.getServiceKey().isBlank();

        List<HiraHospItem> items = hiraHospitalClient.getHospBasisList(pageNo, numOfRows);
        List<String> ykihoList = items.stream()
                .map(HiraHospItem::getYkiho)
                .filter(y -> y != null && !y.isBlank())
                .toList();

        Set<String> existingCodes = ykihoList.isEmpty()
                ? Set.of()
                : hospitalRepository.findAllByPublicCodeIn(ykihoList).stream()
                        .map(Hospital::getPublicCode)
                        .collect(Collectors.toSet());

        List<Hospital> toSave = items.stream()
                .filter(item -> {
                    String ykiho = item.getYkiho();
                    if (ykiho == null || ykiho.isBlank()) return false;
                    if (existingCodes.contains(trim(ykiho, 500))) return false;
                    String name = trim(item.getYadmNm(), 200);
                    return name != null && !name.isBlank();
                })
                .map(this::toHospital)
                .toList();

        hospitalRepository.saveAll(toSave);
        int saved = toSave.size();
        log.info("HIRA 동기화: pageNo={}, numOfRows={}, 조회={}, 신규저장={}", pageNo, numOfRows, items.size(), saved);
        return SyncResult.builder()
                .keyConfigured(keyConfigured)
                .fetchedCount(items.size())
                .saved(saved)
                .build();
    }

    private Hospital toHospital(HiraHospItem item) {
        return Hospital.builder()
                .name(trim(item.getYadmNm(), 200))
                .address(trim(item.getAddr(), 500))
                .latitude(parseBigDecimal(toPosString(item.getYPos())))
                .longitude(parseBigDecimal(toPosString(item.getXPos())))
                .phone(trim(item.getTelno(), 20))
                .publicCode(trim(item.getYkiho(), 500))
                .department(trim(item.getClCdNm(), 100))
                .build();
    }

    /** API가 XPos/YPos를 숫자 또는 문자열로 줄 수 있어 안전하게 문자열로 변환 */
    private static String toPosString(Object value) {
        if (value == null) return null;
        return value.toString().trim();
    }

    private static String trim(String value, int maxLen) {
        if (value == null) return null;
        String s = value.trim();
        return s.length() > maxLen ? s.substring(0, maxLen) : s;
    }

    private static BigDecimal parseBigDecimal(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return new BigDecimal(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
