package com.medicheck.server.domain.hospital.service;

import com.medicheck.server.domain.hospital.client.HiraEvaluationClient;
import com.medicheck.server.domain.hospital.dto.RegionSyncResult;
import com.medicheck.server.domain.hospital.client.dto.HiraAsmItem;
import com.medicheck.server.domain.hospital.entity.Hospital;
import com.medicheck.server.domain.hospital.entity.HospitalEvaluation;
import com.medicheck.server.domain.hospital.repository.HospitalEvaluationRepository;
import com.medicheck.server.domain.hospital.repository.HospitalRepository;
import com.medicheck.server.domain.hospital.repository.HospitalSpecification;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * HIRA 병원평가정보(getHospAsmInfo1) API 결과를 DB에 동기화합니다.
 * ykiho(요양기호)로 Hospital과 매칭하여, 등록된 병원에 대해서만 HospitalEvaluation을 저장/갱신합니다.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class HospitalEvaluationSyncService {

    private static final int DEFAULT_PAGE_SIZE = 100;
    private static final int MAX_PAGE = 10_000;

    private final HiraEvaluationClient evaluationClient;
    private final HospitalRepository hospitalRepository;
    private final HospitalEvaluationRepository evaluationRepository;
    private final PlatformTransactionManager transactionManager;

    /**
     * 전체 평가 데이터를 페이지 단위로 조회해, 우리 DB에 있는 병원(ykiho 매칭)만 저장/갱신합니다.
     *
     * @param maxSynced 최대 동기화 건수 (null 또는 0 이하면 제한 없음)
     * @return 저장 또는 갱신된 평가 건수
     */
    @Transactional
    public int syncAll(Integer maxSynced) {
        int totalSaved = 0;
        int pageNo = 1;
        boolean hasLimit = maxSynced != null && maxSynced > 0;

        while (pageNo <= MAX_PAGE) {
            if (hasLimit && totalSaved >= maxSynced) {
                break;
            }
            List<HiraAsmItem> items = evaluationClient.getHospAsmInfo(pageNo, DEFAULT_PAGE_SIZE, null);
            if (items == null || items.isEmpty()) {
                break;
            }
            int saved = saveOrUpdateEvaluations(items, hasLimit ? maxSynced - totalSaved : null);
            totalSaved += saved;
            if (items.size() < DEFAULT_PAGE_SIZE || (hasLimit && totalSaved >= maxSynced)) {
                break;
            }
            pageNo++;
        }

        log.info("병원평가정보 동기화 완료: 총 {} 건 저장/갱신", totalSaved);
        return totalSaved;
    }

    /**
     * 특정 요양기호(ykiho) 한 건만 API에서 조회해 저장/갱신합니다.
     *
     * @param ykiho 암호화된 요양기호 (publicCode와 동일)
     * @return 저장/갱신 시 true, 해당 병원이 없거나 API 결과 없으면 false
     */
    @Transactional
    public boolean syncOne(String ykiho) {
        String normalized = trim(ykiho, 500);
        if (normalized == null || normalized.isBlank()) {
            return false;
        }
        List<HiraAsmItem> items = evaluationClient.getHospAsmInfo(1, 1, normalized);
        if (items == null || items.isEmpty()) {
            return false;
        }
        return saveOrUpdateEvaluations(items, null) > 0;
    }

    /**
     * 주소에 특정 키워드(예: "구미")가 포함된 병원만 골라 평가정보를 1건씩 동기화합니다.
     *
     * <p>HIRA HTTP는 트랜잭션 밖에서 호출하고, DB 저장만 건별 커밋합니다.
     *
     * @param addressKeyword 주소 포함 문자열 (예: "구미")
     * @param maxSynced      최대 API 호출 횟수 (null 이하면 제한 없음). 일일 한도 예산용.
     * @return 동기화·호출 집계 결과
     */
    public RegionSyncResult syncByAddressKeyword(String addressKeyword, Integer maxSynced) {
        if (addressKeyword == null || addressKeyword.isBlank()) {
            return new RegionSyncResult(0, 0, 0, true);
        }
        Specification<Hospital> spec = HospitalSpecification.addressContains(addressKeyword);
        List<Hospital> hospitals = hospitalRepository.findAll(spec);
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        int count = 0;
        int attempted = 0;
        int skipped = 0;
        boolean hitLimit = false;
        for (Hospital h : hospitals) {
            if (maxSynced != null && maxSynced > 0 && attempted >= maxSynced) {
                hitLimit = true;
                break;
            }
            String ykiho = trim(h.getPublicCode(), 500);
            if (ykiho == null || ykiho.isBlank()) continue;
            if (evaluationRepository.findByHospital_Id(h.getId()).isPresent()) {
                skipped++;
                continue;
            }
            attempted++;
            List<HiraAsmItem> items = evaluationClient.getHospAsmInfo(1, 1, ykiho);
            if (items == null || items.isEmpty()) {
                continue;
            }
            Integer saved = tx.execute(status -> saveOrUpdateEvaluations(items, null));
            if (saved != null && saved > 0) {
                count++;
            }
            if (attempted % 50 == 0) {
                log.info("병원평가정보 지역 동기화 진행: addressKeyword={}, attempted={}, synced={}, skippedExisting={}",
                        addressKeyword, attempted, count, skipped);
            }
        }
        boolean complete = !hitLimit;
        log.info("병원평가정보 지역 동기화 완료: addressKeyword={}, {} 건 저장/갱신 (attempted={}, skippedExisting={}, complete={})",
                addressKeyword, count, attempted, skipped, complete);
        return new RegionSyncResult(count, attempted, skipped, complete);
    }

    /**
     * API 응답 item 목록에 대해 Hospital(ykiho=publicCode)이 있는 것만 저장 또는 갱신.
     * @param maxCount 최대 처리 건수 (null 이면 전부)
     */
    private int saveOrUpdateEvaluations(List<HiraAsmItem> items, Integer maxCount) {
        int count = 0;
        if (items == null || items.isEmpty()) {
            return 0;
        }

        // 1) 이번 페이지의 ykiho(요양기호)들을 한 번에 수집
        List<String> ykihoList = items.stream()
                .map(i -> trim(i.getYkiho(), 500))
                .filter(y -> y != null && !y.isBlank())
                .distinct()
                .toList();
        if (ykihoList.isEmpty()) {
            return 0;
        }

        // 2) ykiho(publicCode) 목록으로 병원들을 한 번에 조회
        List<Hospital> hospitals = hospitalRepository.findAllByPublicCodeIn(ykihoList);
        Map<String, Hospital> ykihoToHospital = hospitals.stream()
                .filter(h -> h.getPublicCode() != null && !h.getPublicCode().isBlank())
                .collect(Collectors.toMap(Hospital::getPublicCode, h -> h));

        if (ykihoToHospital.isEmpty()) {
            return 0;
        }

        // 3) 해당 병원들의 평가를 한 번에 조회
        List<Long> hospitalIds = hospitals.stream()
                .map(Hospital::getId)
                .toList();
        List<HospitalEvaluation> existingEvaluations = evaluationRepository.findByHospital_IdIn(hospitalIds);
        Map<Long, HospitalEvaluation> idToEvaluation = existingEvaluations.stream()
                .collect(Collectors.toMap(ev -> ev.getHospital().getId(), ev -> ev));

        // 4) 각 item 에 대해 맵 조회로 저장/갱신 처리
        for (HiraAsmItem item : items) {
            if (maxCount != null && count >= maxCount) {
                break;
            }
            String ykiho = trim(item.getYkiho(), 500);
            if (ykiho == null || ykiho.isBlank()) {
                continue;
            }
            Hospital hospital = ykihoToHospital.get(ykiho);
            if (hospital == null) {
                continue;
            }
            HospitalEvaluation existing = idToEvaluation.get(hospital.getId());
            if (existing != null) {
                // 신규 생성(toEvaluation)과 동일하게 길이 제한을 맞추기 위해 trim 적용
                existing.updateFromApi(
                        trim(item.getYadmNm(), 200),
                        trim(item.getClCd(), 10),
                        trim(item.getClCdNm(), 50),
                        trim(item.getAddr(), 500),
                        item.getAsmGrd01(), item.getAsmGrd03(), item.getAsmGrd04(), item.getAsmGrd05(), item.getAsmGrd06(),
                        item.getAsmGrd07(), item.getAsmGrd08(), item.getAsmGrd09(), item.getAsmGrd10(), item.getAsmGrd12(),
                        item.getAsmGrd13(), item.getAsmGrd14(), item.getAsmGrd15(), item.getAsmGrd16(), item.getAsmGrd17(),
                        item.getAsmGrd18(), item.getAsmGrd19(), item.getAsmGrd20(), item.getAsmGrd21(), item.getAsmGrd22(),
                        item.getAsmGrd23(), item.getAsmGrd24()
                );
                evaluationRepository.save(existing);
            } else {
                HospitalEvaluation ev = toEvaluation(hospital, item);
                evaluationRepository.save(ev);
                idToEvaluation.put(hospital.getId(), ev);
            }
            count++;
        }
        return count;
    }

    private static HospitalEvaluation toEvaluation(Hospital hospital, HiraAsmItem item) {
        return HospitalEvaluation.builder()
                .hospital(hospital)
                .ykiho(trim(item.getYkiho(), 500))
                .yadmNm(trim(item.getYadmNm(), 200))
                .clCd(trim(item.getClCd(), 10))
                .clCdNm(trim(item.getClCdNm(), 50))
                .addr(trim(item.getAddr(), 500))
                .asmGrd01(item.getAsmGrd01())
                .asmGrd03(item.getAsmGrd03())
                .asmGrd04(item.getAsmGrd04())
                .asmGrd05(item.getAsmGrd05())
                .asmGrd06(item.getAsmGrd06())
                .asmGrd07(item.getAsmGrd07())
                .asmGrd08(item.getAsmGrd08())
                .asmGrd09(item.getAsmGrd09())
                .asmGrd10(item.getAsmGrd10())
                .asmGrd12(item.getAsmGrd12())
                .asmGrd13(item.getAsmGrd13())
                .asmGrd14(item.getAsmGrd14())
                .asmGrd15(item.getAsmGrd15())
                .asmGrd16(item.getAsmGrd16())
                .asmGrd17(item.getAsmGrd17())
                .asmGrd18(item.getAsmGrd18())
                .asmGrd19(item.getAsmGrd19())
                .asmGrd20(item.getAsmGrd20())
                .asmGrd21(item.getAsmGrd21())
                .asmGrd22(item.getAsmGrd22())
                .asmGrd23(item.getAsmGrd23())
                .asmGrd24(item.getAsmGrd24())
                .build();
    }

    private static String trim(String value, int maxLen) {
        if (value == null) return null;
        String s = value.trim();
        return s.length() > maxLen ? s.substring(0, maxLen) : s;
    }
}
