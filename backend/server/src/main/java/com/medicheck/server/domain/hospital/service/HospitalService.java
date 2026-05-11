package com.medicheck.server.domain.hospital.service;

import com.medicheck.server.domain.hospital.entity.Hospital;
import com.medicheck.server.domain.hospital.entity.HospitalEvaluation;
import com.medicheck.server.domain.hospital.entity.HospitalClinicTop5;
import com.medicheck.server.domain.hospital.repository.HospitalEvaluationRepository;
import com.medicheck.server.domain.hospital.repository.HospitalClinicTop5Repository;
import com.medicheck.server.domain.hospital.repository.HospitalRepository;
import com.medicheck.server.domain.hospital.repository.HospitalSpecification;
import com.medicheck.server.domain.hospital.dto.HospitalEvaluationSummary;
import com.medicheck.server.domain.hospital.dto.HospitalTop5Summary;
import com.medicheck.server.domain.hospital.dto.HospitalResponse;
import com.medicheck.server.domain.hospital.dto.NearbyHospitalResponse;
import com.medicheck.server.domain.hospital.dto.ReviewSummary;
import com.medicheck.server.domain.hospital.util.SymptomKeywordTokenizer;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * 안심 병원 조회 서비스.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class HospitalService {

    private final HospitalRepository hospitalRepository;
    private final HospitalReviewService reviewService;
    private final HospitalEvaluationRepository hospitalEvaluationRepository;
    private final HospitalClinicTop5Repository hospitalClinicTop5Repository;
    /** 근처 병원 조회 시 한 번에 반환할 최대 개수 (일단 500개로 상한 설정). */
    private static final int NEARBY_MAX_RESULTS = 500;
    /** 근처 병원 조회에서 허용할 최대 반경 (미터) — 예: 50km */
    private static final double MAX_RADIUS_METERS = 50_000;
    /** 증상별 병원 검색: 사용자 lat/lng가 있을 때만 적용하는 최대 반경 (미터) */
    private static final double SYMPTOM_SEARCH_MAX_RADIUS_METERS = 5_000;
    private static final double EARTH_RADIUS_METERS = 6_371_000.0;

    /**
     * 등록된 병원 목록을 페이지 단위로 조회합니다.
     * 검색(keyword), 필터(department), 정렬(sort)을 지원합니다.
     *
     * @param keyword   병원명/주소/진료과 통합 검색 (없으면 무시)
     * @param department 진료과 필터 (없으면 무시)
     * @param pageable  page, size, sort (예: sort=name,asc / sort=createdAt,desc)
     */
    public Page<HospitalResponse> findAll(String keyword, String department, Pageable pageable) {
        Specification<Hospital> spec =
                HospitalSpecification.withFilters(keyword, department);
        return hospitalRepository.findAll(spec, pageable).map(HospitalResponse::from);
    }

    /**
     * DB에 동기화된 HIRA Top5 질병명 중, 증상 검색에 쓸 수 있는 고유 문자열 목록(가나다순, 상한 있음).
     */
    public List<String> findDistinctTop5DiseaseNamesForPicker() {
        return hospitalClinicTop5Repository.findDistinctDiseaseNamesForPicker();
    }

    /**
     * 증상(또는 질환) 키워드로 검색합니다. HIRA 동기화된 병원진료정보 Top5(상위 5개 질병명) 필드와 부분 일치하는 병원만 반환합니다.
     * 토큰은 공백·쉼표로 나누며, 토큰 하나라도 질병명에 매칭되면 포함(OR)합니다.
     * 사용자 좌표(lat/lng)가 있으면 Haversine 거리 5km 이내 병원만 포함합니다.
     * 정렬: 좌표가 있으면 거리 오름차순을 먼저 적용한 뒤, 같은 거리에서는 매칭 슬롯(1위→5위)이 앞선 병원이 먼저입니다.
     * 좌표가 없으면 반경 필터 없이 슬롯 우선·거리는 무한대로 두고 이름으로 타이브레이크합니다.
     */
    public Page<HospitalResponse> findAllBySymptom(
            String symptom,
            BigDecimal userLat,
            BigDecimal userLng,
            Pageable pageable
    ) {
        if (!StringUtils.hasText(symptom)) {
            return Page.empty(pageable);
        }
        List<String> tokens = SymptomKeywordTokenizer.tokenize(symptom);
        if (tokens.isEmpty()) {
            return Page.empty(pageable);
        }
        LinkedHashSet<String> uniqueSafeTokens = new LinkedHashSet<>();
        for (String token : tokens) {
            String safe = sanitizeLikeSubstring(token);
            if (safe.length() < 2) {
                continue;
            }
            uniqueSafeTokens.add(safe);
        }
        if (uniqueSafeTokens.isEmpty()) {
            return Page.empty(pageable);
        }
        List<String> safeTokens = new ArrayList<>(uniqueSafeTokens);
        List<Long> unionIds =
                hospitalClinicTop5Repository.findHospitalIdsWithDiseaseNameContainingAny(safeTokens);
        if (unionIds.isEmpty()) {
            return Page.empty(pageable);
        }

        List<Long> idList = new ArrayList<>(unionIds);
        List<HospitalClinicTop5> top5Rows =
                hospitalClinicTop5Repository.findAllByHospitalIdInWithHospitalFetch(idList);

        boolean hasUserCoords = userLat != null && userLng != null;
        List<RankedHospital> ranked = new ArrayList<>();
        for (HospitalClinicTop5 t : top5Rows) {
            Hospital h = t.getHospital();
            int rank = bestTop5MatchRank(t, safeTokens);
            if (rank > 5) {
                continue;
            }
            double distM = haversineMeters(userLat, userLng, h.getLatitude(), h.getLongitude());
            if (hasUserCoords) {
                if (!Double.isFinite(distM) || distM > SYMPTOM_SEARCH_MAX_RADIUS_METERS) {
                    continue;
                }
            }
            ranked.add(new RankedHospital(rank, distM, h));
        }

        Comparator<RankedHospital> byName = Comparator.comparing(
                r -> r.hospital().getName(), Comparator.nullsLast(String::compareTo));
        if (hasUserCoords) {
            ranked.sort(Comparator
                    .comparingDouble(RankedHospital::distanceMeters)
                    .thenComparingInt(RankedHospital::matchRank)
                    .thenComparing(byName));
        } else {
            ranked.sort(Comparator
                    .comparingInt(RankedHospital::matchRank)
                    .thenComparingDouble(RankedHospital::distanceMeters)
                    .thenComparing(byName));
        }

        long total = ranked.size();
        int pageNumber = pageable.getPageNumber();
        int pageSize = pageable.getPageSize();
        int from = Math.min(pageNumber * pageSize, ranked.size());
        int to = Math.min(from + pageSize, ranked.size());
        List<Hospital> slice = ranked.subList(from, to).stream()
                .map(RankedHospital::hospital)
                .toList();

        List<HospitalResponse> content = enrichHospitalResponses(slice);
        Pageable pageMeta = PageRequest.of(pageNumber, pageSize);
        return new PageImpl<>(content, pageMeta, total);
    }

    private record RankedHospital(int matchRank, double distanceMeters, Hospital hospital) {
    }

    /**
     * 토큰별로 질병명 1~5 슬롯 중 가장 앞(가장 상위)에 매칭되는 순번을 구하고, 토큰 간 최솟값을 반환합니다.
     * JPQL LIKE 부분 일치와 동일하게 {@code contains}로 비교합니다.
     */
    private static int bestTop5MatchRank(HospitalClinicTop5 t, List<String> safeTokens) {
        int best = Integer.MAX_VALUE;
        String[] fields = {
                t.getDiseaseNm1(), t.getDiseaseNm2(), t.getDiseaseNm3(), t.getDiseaseNm4(), t.getDiseaseNm5()
        };
        for (String token : safeTokens) {
            if (token.length() < 2) {
                continue;
            }
            String tl = token.toLowerCase(Locale.ROOT);
            int tokenBest = Integer.MAX_VALUE;
            for (int i = 0; i < 5; i++) {
                String d = fields[i];
                if (d == null || d.isBlank()) {
                    continue;
                }
                if (d.toLowerCase(Locale.ROOT).contains(tl)) {
                    tokenBest = Math.min(tokenBest, i + 1);
                }
            }
            if (tokenBest != Integer.MAX_VALUE) {
                best = Math.min(best, tokenBest);
            }
        }
        return best == Integer.MAX_VALUE ? 6 : best;
    }

    private static double haversineMeters(
            BigDecimal userLat,
            BigDecimal userLng,
            BigDecimal hospLat,
            BigDecimal hospLng
    ) {
        if (userLat == null || userLng == null || hospLat == null || hospLng == null) {
            return Double.POSITIVE_INFINITY;
        }
        double lat1 = userLat.doubleValue();
        double lon1 = userLng.doubleValue();
        double lat2 = hospLat.doubleValue();
        double lon2 = hospLng.doubleValue();
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS_METERS * c;
    }

    /** LIKE 패턴에 넣기 전에 %, _, \\ 문자를 제거해 의도치 않은 와일드카드·이스케이프를 막습니다. */
    private static String sanitizeLikeSubstring(String raw) {
        if (raw == null) {
            return "";
        }
        return raw.trim().replace("%", "").replace("_", "").replace("\\", "");
    }

    private List<HospitalResponse> enrichHospitalResponses(List<Hospital> hospitals) {
        if (hospitals.isEmpty()) {
            return List.of();
        }
        List<Long> ids = hospitals.stream().map(Hospital::getId).toList();
        Map<Long, ReviewSummary> reviewSummaryMap = reviewService.getReviewSummaryByHospitalIds(ids);
        List<HospitalEvaluation> evaluations = hospitalEvaluationRepository.findByHospital_IdIn(ids);
        Map<Long, HospitalEvaluationSummary> evaluationMap = evaluations.stream()
                .collect(Collectors.toMap(ev -> ev.getHospital().getId(), HospitalEvaluationSummary::from));
        List<HospitalClinicTop5> top5s = hospitalClinicTop5Repository.findByHospital_IdIn(ids);
        Map<Long, HospitalTop5Summary> top5Map = top5s.stream()
                .collect(Collectors.toMap(t -> t.getHospital().getId(), HospitalTop5Summary::from));

        return hospitals.stream().map(h -> {
            Long id = h.getId();
            HospitalResponse hr = HospitalResponse.from(h);
            ReviewSummary rs = reviewSummaryMap.get(id);
            if (rs != null) {
                hr = hr.toBuilder()
                        .averageRating(rs.getAverageRating())
                        .reviewCount(rs.getReviewCount().intValue())
                        .build();
            }
            HospitalEvaluationSummary es = evaluationMap.get(id);
            if (es != null) {
                hr = hr.toBuilder().evaluation(es).build();
            }
            HospitalTop5Summary top5 = top5Map.get(id);
            if (top5 != null) {
                hr = hr.toBuilder().top5(top5).build();
            }
            return hr;
        }).toList();
    }

    /**
     * ID로 병원 한 건 조회합니다.
     *
     * @param id 병원 ID
     * @return 병원이 있으면 HospitalResponse, 없으면 empty
     */
    public Optional<HospitalResponse> findById(Long id) {
        return hospitalRepository.findById(id).map(h -> {
            HospitalResponse hr = HospitalResponse.from(h);

            // 리뷰 요약
            Map<Long, ReviewSummary> map = reviewService.getReviewSummaryByHospitalIds(List.of(id));
            ReviewSummary summary = map.get(id);
            if (summary != null) {
                hr = hr.toBuilder()
                        .averageRating(summary.getAverageRating())
                        .reviewCount(summary.getReviewCount().intValue())
                        .build();
            }

            // 병원평가정보 요약
            Optional<HospitalEvaluation> evOpt = hospitalEvaluationRepository.findByHospital_Id(id);
            if (evOpt.isPresent()) {
                HospitalEvaluationSummary evalDto = HospitalEvaluationSummary.from(evOpt.get());
                hr = hr.toBuilder()
                        .evaluation(evalDto)
                        .build();
            }

            // 병원진료정보(Top5) 요약
            Optional<HospitalClinicTop5> top5Opt = hospitalClinicTop5Repository.findByHospital_Id(id);
            if (top5Opt.isPresent()) {
                HospitalTop5Summary top5Dto = HospitalTop5Summary.from(top5Opt.get());
                hr = hr.toBuilder()
                        .top5(top5Dto)
                        .build();
            }
            return hr;
        });
    }

    /**
     * 사용자의 위치 기준 반경(radiusMeters m) 내 병원을 거리순으로 조회합니다.
     * 각 항목에 사용자 위치에서의 거리(distanceMeters)가 포함됩니다.
     *
     * @param latitude     사용자 위도 (WGS84)
     * @param longitude    사용자 경도 (WGS84)
     * @param radiusMeters 반경 (미터)
     */
    /**
     * TODO: 반경이 매우 큰(예: 50km) 요청에 대해서는 서버 페이징이나 프론트 단 마커 클러스터링 도입을 검토.
     * 현재는 최대 500개까지만 한 번에 반환하며, 그 이상은 잘린다는 정보를 별도 헤더로 노출합니다.
     */
    public List<NearbyHospitalResponse> findNearby(BigDecimal latitude, BigDecimal longitude, double radiusMeters) {
        if (latitude == null || longitude == null) {
            throw new IllegalArgumentException("latitude and longitude must not be null");
        }
        if (radiusMeters <= 0) {
            throw new IllegalArgumentException("radiusMeters must be greater than 0");
        }

        double effectiveRadius = Math.min(radiusMeters, MAX_RADIUS_METERS);

        // 하나 더 가져와서(NEARBY_MAX_RESULTS + 1) 잘림 여부를 감지한다.
        List<Object[]> idAndDistance = hospitalRepository.findNearbyIdAndDistance(
                latitude.doubleValue(),
                longitude.doubleValue(),
                effectiveRadius,
                NEARBY_MAX_RESULTS + 1
        );

        if (idAndDistance.isEmpty()) {
            NearbyQueryContextHolder.clear();
            return List.of();
        }

        boolean truncated = idAndDistance.size() > NEARBY_MAX_RESULTS;
        List<Long> orderedIds = idAndDistance.stream()
                .limit(NEARBY_MAX_RESULTS)
                .map(row -> ((Number) row[0]).longValue())
                .toList();
        Map<Long, Double> idToDistance = idAndDistance.stream()
                .collect(Collectors.toMap(row -> ((Number) row[0]).longValue(), row -> ((Number) row[1]).doubleValue()));

        List<Hospital> hospitals = hospitalRepository.findAllById(orderedIds);
        Map<Long, Hospital> idToHospital = hospitals.stream().collect(Collectors.toMap(Hospital::getId, h -> h));

        // 응답 헤더에서 사용할 수 있도록 쓰레드 로컬에 메타데이터 보관
        NearbyQueryContextHolder.setMetadata(new NearbyQueryMetadata(
                orderedIds.size(),
                truncated
        ));

        Map<Long, ReviewSummary> reviewSummaryMap = reviewService.getReviewSummaryByHospitalIds(orderedIds);

        List<HospitalEvaluation> evaluations = hospitalEvaluationRepository.findByHospital_IdIn(orderedIds);
        Map<Long, HospitalEvaluationSummary> evaluationMap = evaluations.stream()
                .collect(Collectors.toMap(ev -> ev.getHospital().getId(), HospitalEvaluationSummary::from));

        List<HospitalClinicTop5> top5s = hospitalClinicTop5Repository.findByHospital_IdIn(orderedIds);
        Map<Long, HospitalTop5Summary> top5Map = top5s.stream()
                .collect(Collectors.toMap(t -> t.getHospital().getId(), HospitalTop5Summary::from));

        return orderedIds.stream()
                .map(id -> {
                    Hospital h = idToHospital.get(id);
                    Double dist = idToDistance.get(id);
                    if (h == null || dist == null) return null;
                    HospitalResponse hr = HospitalResponse.from(h);
                    ReviewSummary summary = reviewSummaryMap.get(id);
                    if (summary != null) {
                        hr = hr.toBuilder()
                                .averageRating(summary.getAverageRating())
                                .reviewCount(summary.getReviewCount().intValue())
                                .build();
                    }
                    HospitalEvaluationSummary evalSummary = evaluationMap.get(id);
                    if (evalSummary != null) {
                        hr = hr.toBuilder().evaluation(evalSummary).build();
                    }
                    HospitalTop5Summary top5Summary = top5Map.get(id);
                    if (top5Summary != null) {
                        hr = hr.toBuilder().top5(top5Summary).build();
                    }
                    return NearbyHospitalResponse.builder()
                            .hospital(hr)
                            .distanceMeters(dist)
                            .build();
                })
                .filter(r -> r != null)
                .toList();
    }
}
