package com.medicheck.server.client.hira;

import com.medicheck.server.client.hira.dto.HiraApiResponse;
import com.medicheck.server.client.hira.dto.HiraHospItem;
import com.medicheck.server.config.HiraApiProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.List;

/**
 * 건강보험심사평가원 병원정보 Open API 클라이언트.
 * getHospBasisList1(병원기본목록) 호출.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class HiraHospitalClient {

    /** 포털 상세기능: 병원기본목록 /getHospBasisList (v2는 1 접미사 없음) */
    private static final String OPERATION = "getHospBasisList";
    private static final String RESPONSE_TYPE_JSON = "json";

    private final HiraApiProperties properties;
    private final RestTemplate restTemplate = new RestTemplate();

    /**
     * 병원기본목록 조회 (페이징).
     *
     * @param pageNo    페이지 번호 (1부터)
     * @param numOfRows 한 페이지 결과 수
     * @return HIRA API 응답의 병원 목록 (인증키 미설정 또는 오류 시 빈 리스트)
     */
    /** 시도코드 없이 호출 시 서울(110000) 기준으로 조회 (일부 API는 조건 없으면 500 반환) */
    public List<HiraHospItem> getHospBasisList(int pageNo, int numOfRows) {
        return getHospBasisList(pageNo, numOfRows, "110000", null, null, null, null, null, null);
    }

    /**
     * 병원기본목록 조회 (옵션 파라미터 지원).
     * 한글 파라미터는 UTF-8 인코딩 후 전달됩니다.
     */
    @SuppressWarnings("java:S107")
    public List<HiraHospItem> getHospBasisList(
            int pageNo,
            int numOfRows,
            String sidoCd,
            String sgguCd,
            String emdongNm,
            String yadmNm,
            String xPos,
            String yPos,
            Integer radius
    ) {
        if (properties.getServiceKey() == null || properties.getServiceKey().isBlank()) {
            log.warn("HIRA API 인증키가 설정되지 않았습니다. 환경변수 HIRA_SERVICE_KEY 를 설정하세요.");
            return Collections.emptyList();
        }

        try {
            UriComponentsBuilder builder = UriComponentsBuilder
                    .fromUriString(properties.getBaseUrl() + "/" + OPERATION)
                    // ServiceKey 는 원본 값을 넘기고, build().encode() 로 일괄 인코딩
                    .queryParam("ServiceKey", properties.getServiceKey())
                    .queryParam("pageNo", pageNo)
                    .queryParam("numOfRows", numOfRows)
                    .queryParam("_type", RESPONSE_TYPE_JSON);

            if (sidoCd != null && !sidoCd.isBlank()) builder.queryParam("sidoCd", sidoCd);
            if (sgguCd != null && !sgguCd.isBlank()) builder.queryParam("sgguCd", sgguCd);
            if (emdongNm != null && !emdongNm.isBlank()) builder.queryParam("emdongNm", emdongNm);
            if (yadmNm != null && !yadmNm.isBlank()) builder.queryParam("yadmNm", yadmNm);
            if (xPos != null && !xPos.isBlank()) builder.queryParam("xPos", xPos);
            if (yPos != null && !yPos.isBlank()) builder.queryParam("yPos", yPos);
            if (radius != null && radius > 0) builder.queryParam("radius", radius);

            URI uri = builder.build().encode().toUri();
            ResponseEntity<HiraApiResponse> response = restTemplate.getForEntity(uri, HiraApiResponse.class);
            HiraApiResponse body = response.getBody();

            if (body == null) {
                log.warn("HIRA API 응답 body가 null입니다.");
                return Collections.emptyList();
            }
            if (body.getResponse() != null && body.getResponse().getHeader() != null) {
                String code = body.getResponse().getHeader().getResultCode();
                String msg = body.getResponse().getHeader().getResultMsg();
                if (!"00".equals(code)) {
                    log.warn("HIRA API 오류: resultCode={}, resultMsg={}", code, msg);
                    return Collections.emptyList();
                }
                // 정상이지만 조회 결과가 없을 수 있음 (totalCount 0 등)
                if (body.getResponse().getBody() != null && body.getItemList().isEmpty()) {
                    log.info("HIRA API 정상 응답이지만 item 없음. totalCount={}, pageNo={}",
                            body.getResponse().getBody().getTotalCount(),
                            body.getResponse().getBody().getPageNo());
                }
            }

            return body.getItemList();
        } catch (Exception e) {
            log.error("HIRA API 호출 실패", e);
            return Collections.emptyList();
        }
    }

    /**
     * HIRA API 원문 응답 조회 (디버그용). 시도코드(sidoCd) 포함 시 500 방지.
     */
    public RawResponseResult getRawResponse(int pageNo, int numOfRows) {
        return getRawResponse(pageNo, numOfRows, "110000");
    }

    public RawResponseResult getRawResponse(int pageNo, int numOfRows, String sidoCd) {
        boolean keyConfigured = properties.getServiceKey() != null && !properties.getServiceKey().isBlank();
        if (!keyConfigured) {
            return new RawResponseResult(false, null, "인증키 미설정. local 프로필 또는 HIRA_SERVICE_KEY 확인.");
        }
        try {
            UriComponentsBuilder builder = UriComponentsBuilder
                    .fromUriString(properties.getBaseUrl() + "/" + OPERATION)
                    .queryParam("ServiceKey", properties.getServiceKey())
                    .queryParam("pageNo", pageNo)
                    .queryParam("numOfRows", numOfRows)
                    .queryParam("_type", RESPONSE_TYPE_JSON);
            if (sidoCd != null && !sidoCd.isBlank()) {
                builder.queryParam("sidoCd", sidoCd);
            }
            URI uri = builder.build().encode().toUri();
            String raw = restTemplate.getForObject(uri, String.class);
            return new RawResponseResult(true, raw != null ? raw : "(empty)", null);
        } catch (Exception e) {
            log.error("HIRA API raw 호출 실패", e);
            return new RawResponseResult(true, null, e.getMessage());
        }
    }

    public record RawResponseResult(boolean keyConfigured, String rawResponse, String error) {}
}
