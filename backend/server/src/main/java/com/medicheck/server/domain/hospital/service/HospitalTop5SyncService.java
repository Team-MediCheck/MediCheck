package com.medicheck.server.domain.hospital.service;

import com.medicheck.server.domain.hospital.client.HiraClinicTop5Client;
import com.medicheck.server.domain.hospital.client.dto.HiraClinicTop5Item;
import com.medicheck.server.domain.hospital.dto.Top5BulkResult;
import com.medicheck.server.domain.hospital.entity.Hospital;
import com.medicheck.server.domain.hospital.entity.HospitalClinicTop5;
import com.medicheck.server.domain.hospital.repository.HospitalClinicTop5Repository;
import com.medicheck.server.domain.hospital.repository.HospitalRepository;
import com.medicheck.server.domain.hospital.repository.HospitalSpecification;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.Optional;

/**
 * HIRA 병원진료정보조회서비스(getClinicTop5List1) 결과를 DB에 동기화합니다.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class HospitalTop5SyncService {

    private static final int DEFAULT_PAGE_NO = 1;
    private static final int DEFAULT_NUM_OF_ROWS = 10;

    private final HiraClinicTop5Client clinicTop5Client;
    private final HospitalRepository hospitalRepository;
    private final HospitalClinicTop5Repository top5Repository;
    private final PlatformTransactionManager transactionManager;

    /**
     * DB에 있는 병원을 id 순으로 순회하며 요양기호당 Top5 API를 1건씩 호출합니다.
     *
     * @param maxAttempts ykiho가 있는 병원에 대해 API 호출 최대 횟수 (양수 필수)
     * @param pageSize    한 번에 읽는 병원 페이지 크기(내부 배치)
     */
    public Top5BulkResult syncAllByHospital(int maxAttempts, int pageSize) {
        if (maxAttempts <= 0) {
            throw new IllegalArgumentException("maxAttempts must be positive");
        }
        int effectivePageSize = pageSize > 0 ? pageSize : 100;
        int attempted = 0;
        int succeeded = 0;
        int pageIndex = 0;
        while (true) {
            Page<Hospital> batch = hospitalRepository.findAll(
                    PageRequest.of(pageIndex, effectivePageSize, Sort.by(Sort.Direction.ASC, "id")));
            if (batch.isEmpty()) {
                break;
            }
            for (Hospital h : batch) {
                if (attempted >= maxAttempts) {
                    log.info("병원진료정보 Top5 순회 중단(상한): attempted={}, succeeded={}, maxAttempts={}",
                            attempted, succeeded, maxAttempts);
                    return new Top5BulkResult(attempted, succeeded);
                }
                String ykiho = trim(h.getPublicCode(), 500);
                if (ykiho == null || ykiho.isBlank()) {
                    continue;
                }
                attempted++;
                if (syncOneForHospital(h)) {
                    succeeded++;
                }
            }
            if (!batch.hasNext()) {
                break;
            }
            pageIndex++;
        }
        log.info("병원진료정보 Top5 전체 순회 완료: attempted={}, succeeded={}", attempted, succeeded);
        return new Top5BulkResult(attempted, succeeded);
    }

    /**
     * 주소(address) 포함 키워드(예: 구미)가 들어간 병원만 Top5를 1건씩 동기화한다.
     */
    public int syncByAddressKeyword(String addressKeyword, Integer maxSynced) {
        if (addressKeyword == null || addressKeyword.isBlank()) return 0;

        Specification<Hospital> spec = HospitalSpecification.addressContains(addressKeyword);
        List<Hospital> hospitals;
        if (maxSynced != null && maxSynced > 0) {
            // maxSynced가 지정되면 성공 건수 기준이 아니라 후보 조회 수 자체를 제한해 요청 시간을 예측 가능하게 만든다.
            hospitals = hospitalRepository.findAll(spec, PageRequest.of(0, maxSynced)).getContent();
        } else {
            hospitals = hospitalRepository.findAll(spec);
        }

        int count = 0;
        for (Hospital h : hospitals) {
            if (syncOneForHospital(h)) {
                count++;
            }
        }

        log.info("병원진료정보 Top5 지역 동기화 완료: addressKeyword={}, synced={}", addressKeyword, count);
        return count;
    }

    /**
     * 특정 병원(요양기호)의 Top5 1건을 동기화한다.
     *
     * @return 저장/갱신 성공 여부
     */
    public boolean syncOne(String ykiho) {
        if (ykiho == null || ykiho.isBlank()) return false;
        String normalized = trim(ykiho, 500);
        if (normalized == null || normalized.isBlank()) {
            log.info("Top5 1건 동기화 스킵: ykiho 비어 있음");
            return false;
        }

        Optional<Hospital> hospitalOpt = hospitalRepository.findByPublicCode(normalized);
        if (hospitalOpt.isEmpty()) {
            log.info("Top5 1건 동기화 스킵: DB 병원 미존재 ykiho={}", normalized);
            return false;
        }
        return syncOneForHospital(hospitalOpt.get());
    }

    /**
     * 이미 DB에 로드된 {@link Hospital}에 대해서만 Top5를 조회·저장합니다(DB 재조회 없음).
     */
    public boolean syncOneForHospital(Hospital hospital) {
        String normalized = trim(hospital.getPublicCode(), 500);
        if (normalized == null || normalized.isBlank()) {
            return false;
        }

        HiraClinicTop5Item item = clinicTop5Client.getClinicTop5List1(
                normalized, DEFAULT_PAGE_NO, DEFAULT_NUM_OF_ROWS
        );
        if (item == null) {
            long deleted = deleteTop5ByHospitalId(hospital.getId());
            log.info("Top5 1건 동기화 스킵: 공공데이터 응답 없음 ykiho={}, hospitalId={}, staleHospitalClinicTop5Deleted={}",
                    normalized, hospital.getId(), deleted);
            return false;
        }

        HospitalClinicTop5 newData = HospitalClinicTop5.builder()
                .hospital(hospital)
                .ykiho(trim(item.getYkiho(), 500))
                .crtrYm(trim(item.getCrtrYm(), 10))
                .diseaseNm1(trim(item.getMfrnIntrsIlnsNm1(), 100))
                .diseaseNm2(trim(item.getMfrnIntrsIlnsNm2(), 100))
                .diseaseNm3(trim(item.getMfrnIntrsIlnsNm3(), 100))
                .diseaseNm4(trim(item.getMfrnIntrsIlnsNm4(), 100))
                .diseaseNm5(trim(item.getMfrnIntrsIlnsNm5(), 100))
                .build();

        upsertTop5(hospital.getId(), newData);
        return true;
    }

    protected long deleteTop5ByHospitalId(Long hospitalId) {
        return new TransactionTemplate(transactionManager)
                .execute(status -> top5Repository.deleteByHospital_Id(hospitalId));
    }

    protected void upsertTop5(Long hospitalId, HospitalClinicTop5 newData) {
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            Optional<HospitalClinicTop5> existingOpt = top5Repository.findByHospital_Id(hospitalId);
            if (existingOpt.isPresent()) {
                existingOpt.get().updateFromApi(newData);
                top5Repository.save(existingOpt.get());
                return;
            }
            top5Repository.save(newData);
        });
    }

    private static String trim(String value, int maxLen) {
        if (value == null) return null;
        String s = value.trim();
        return s.length() > maxLen ? s.substring(0, maxLen) : s;
    }
}

