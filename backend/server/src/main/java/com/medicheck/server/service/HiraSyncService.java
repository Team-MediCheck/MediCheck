package com.medicheck.server.service;

import com.medicheck.server.client.hira.HiraHospitalClient;
import com.medicheck.server.client.hira.dto.HiraHospItem;
import com.medicheck.server.config.HiraApiProperties;
import com.medicheck.server.dto.SyncResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * HIRA 병원정보 Open API 데이터를 DB에 동기화하는 서비스.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class HiraSyncService {

    private final HiraHospitalClient hiraHospitalClient;
    private final HospitalPersistenceService hospitalPersistenceService;
    private final HiraApiProperties hiraApiProperties;

    /** HIRA 페이징에 대한 안전장치: 시·도별 최대 페이지 수 상한 */
    private static final int MAX_PAGE = 500;

    /**
     * HIRA API에서 병원기본목록을 조회해 DB에 저장합니다.
     * 동일 publicCode(ykiho)가 있으면 건너뜁니다.
     *
     * @param pageNo    페이지 번호 (1부터)
     * @param numOfRows 한 페이지 결과 수 (최대 1000 등 API 제한 확인)
     * @return 동기화 결과 (인증키 여부, 조회 건수, 저장 건수)
     */
    public SyncResult syncFromHira(int pageNo, int numOfRows) {
        boolean keyConfigured = hiraApiProperties.getServiceKey() != null
                && !hiraApiProperties.getServiceKey().isBlank();

        List<HiraHospItem> items = hiraHospitalClient.getHospBasisList(pageNo, numOfRows);
        int saved = hospitalPersistenceService.saveNewHospitals(items);

        log.info("HIRA 동기화(서울 기본): pageNo={}, numOfRows={}, 조회={}, 신규저장={}",
                pageNo, numOfRows, items.size(), saved);
        return SyncResult.builder()
                .keyConfigured(keyConfigured)
                .fetchedCount(items.size())
                .saved(saved)
                .build();
    }

    /**
     * 전국 시·도 코드를 순회하며 HIRA 병원정보를 모두 동기화합니다.
     * 이미 존재하는 publicCode(ykiho)는 건너뜁니다.
     *
     * @param numOfRows 페이지당 조회 건수 (API 허용 범위 내에서 충분히 큰 값 권장)
     */
    public SyncResult syncAllRegions(int numOfRows) {
        boolean keyConfigured = hiraApiProperties.getServiceKey() != null
                && !hiraApiProperties.getServiceKey().isBlank();
        if (!keyConfigured) {
            return SyncResult.builder()
                    .keyConfigured(false)
                    .fetchedCount(0)
                    .saved(0)
                    .build();
        }

        // HIRA 시·도 코드 목록 (행정구역 코드 기준)
        List<String> sidoCodes = List.of(
                "110000", // 서울특별시
                "260000", // 부산광역시
                "270000", // 대구광역시
                "280000", // 인천광역시
                "290000", // 광주광역시
                "300000", // 대전광역시
                "310000", // 울산광역시
                "360000", // 세종특별자치시
                "410000", // 경기도
                "420000", // 강원도
                "430000", // 충청북도
                "440000", // 충청남도
                "450000", // 전라북도
                "460000", // 전라남도
                "470000", // 경상북도
                "480000", // 경상남도
                "490000"  // 제주특별자치도
        );

        int totalFetched = 0;
        int totalSaved = 0;

        for (String sidoCd : sidoCodes) {
            int pageNo = 1;
            while (true) {
                if (pageNo > MAX_PAGE) {
                    log.warn("HIRA 동기화 중단: sidoCd={} pageNo={} 가 MAX_PAGE={} 를 초과했습니다. 무한 루프 방지.",
                            sidoCd, pageNo, MAX_PAGE);
                    break;
                }

                List<HiraHospItem> items = hiraHospitalClient.getHospBasisList(
                        pageNo,
                        numOfRows,
                        sidoCd,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null
                );

                if (items.isEmpty()) {
                    log.info("HIRA 동기화 종료: sidoCd={}, pageNo={} (더 이상 item 없음)", sidoCd, pageNo);
                    break;
                }

                int saved = hospitalPersistenceService.saveNewHospitals(items);
                totalFetched += items.size();
                totalSaved += saved;

                log.info("HIRA 동기화: sidoCd={}, pageNo={}, numOfRows={}, 조회={}, 신규저장={}",
                        sidoCd, pageNo, numOfRows, items.size(), saved);

                pageNo++;
            }
        }

        return SyncResult.builder()
                .keyConfigured(true)
                .fetchedCount(totalFetched)
                .saved(totalSaved)
                .build();
    }

}
