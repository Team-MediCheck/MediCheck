package com.medicheck.server.service;

import com.medicheck.server.client.hira.dto.HiraHospItem;
import com.medicheck.server.domain.entity.Hospital;
import com.medicheck.server.domain.repository.HospitalRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * HIRA 응답을 Hospital 엔티티로 저장하는 영속성 전담 서비스.
 * 트랜잭션 경계를 이 레이어에 두어, 대량 동기화에서도 페이지/지역 단위로 커밋되도록 한다.
 */
@Service
@RequiredArgsConstructor
public class HospitalPersistenceService {

    private final HospitalRepository hospitalRepository;

    /**
     * HIRA 응답 item 리스트 중 아직 DB에 없는 병원만 골라 저장하고, 저장된 건수를 반환합니다.
     * 한 번 호출이 하나의 트랜잭션으로 처리됩니다.
     */
    @Transactional
    public int saveNewHospitals(List<HiraHospItem> items) {
        if (items == null || items.isEmpty()) {
            return 0;
        }

        // ykiho(요양기호)는 저장 시 trim(…, 500)을 적용하므로, 조회·중복 체크에도 동일한 정규화를 사용
        List<String> ykihoList = items.stream()
                .map(HiraHospItem::getYkiho)
                .map(y -> trim(y, 500))
                .filter(y -> y != null && !y.isBlank())
                .distinct()
                .toList();

        Set<String> existingCodes = ykihoList.isEmpty()
                ? Set.of()
                : hospitalRepository.findAllByPublicCodeIn(ykihoList).stream()
                        .map(Hospital::getPublicCode)
                        .collect(Collectors.toSet());

        // 동일 배치 내 중복 ykiho 저장 방지를 위한 로컬 Set
        Set<String> seenCodes = new java.util.HashSet<>();

        List<Hospital> toSave = items.stream()
                .filter(item -> {
                    String rawYkiho = item.getYkiho();
                    String ykiho = trim(rawYkiho, 500);
                    if (ykiho == null || ykiho.isBlank()) return false;
                    if (existingCodes.contains(ykiho)) return false;
                    if (!seenCodes.add(ykiho)) return false; // 배치 내 중복 제거
                    String name = trim(item.getYadmNm(), 200);
                    return name != null && !name.isBlank();
                })
                .map(this::toHospital)
                .toList();

        hospitalRepository.saveAll(toSave);
        return toSave.size();
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
                .doctorTotalCount(parseInteger(item.getDrTotCnt()))
                .establishedDate(parseEstbDd(item.getEstbDd()))
                .mdeptSpecialistCount(parseInteger(item.getMdeptSdrCnt()))
                .mdeptGeneralCount(parseInteger(item.getMdeptGdrCnt()))
                .mdeptInternCount(parseInteger(item.getMdeptIntnCnt()))
                .mdeptResidentCount(parseInteger(item.getMdeptResdntCnt()))
                .detySpecialistCount(parseInteger(item.getDetySdrCnt()))
                .cmdcSpecialistCount(parseInteger(item.getCmdcSdrCnt()))
                .build();
    }

    private static Integer parseInteger(Object value) {
        if (value == null) return null;
        if (value instanceof Number n) return n.intValue();
        String s = value.toString().trim();
        if (s.isBlank()) return null;
        try {
            return Integer.parseInt(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static final DateTimeFormatter ESTB_DD = DateTimeFormatter.ofPattern("yyyyMMdd");

    private static LocalDate parseEstbDd(String estbDd) {
        if (estbDd == null || estbDd.length() != 8) return null;
        try {
            return LocalDate.parse(estbDd.trim(), ESTB_DD);
        } catch (DateTimeParseException e) {
            return null;
        }
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

