package com.medicheck.server.client.hira.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * HIRA 병원정보서비스 getHospBasisList1 응답의 한 건(병원) DTO.
 * JSON 필드명은 API 명세 기준 (대소문자 포함).
 */
@Getter
@Setter
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class HiraHospItem {

    @JsonProperty("ykiho")
    private String ykiho;

    @JsonProperty("yadmNm")
    private String yadmNm;

    @JsonProperty("clCd")
    private String clCd;

    @JsonProperty("clCdNm")
    private String clCdNm;

    @JsonProperty("sidoCd")
    private String sidoCd;

    @JsonProperty("sidoCdNm")
    private String sidoCdNm;

    @JsonProperty("sgguCd")
    private String sgguCd;

    @JsonProperty("sgguCdNm")
    private String sgguCdNm;

    @JsonProperty("emdongNm")
    private String emdongNm;

    @JsonProperty("postNo")
    private String postNo;

    @JsonProperty("addr")
    private String addr;

    @JsonProperty("telno")
    private String telno;

    @JsonProperty("hospUrl")
    private String hospUrl;

    @JsonProperty("estbDd")
    private String estbDd;

    @JsonProperty("drTotCnt")
    private Object drTotCnt;

    @JsonProperty("mdeptSdrCnt")
    private Object mdeptSdrCnt;

    @JsonProperty("mdeptGdrCnt")
    private Object mdeptGdrCnt;

    @JsonProperty("mdeptIntnCnt")
    private Object mdeptIntnCnt;

    @JsonProperty("mdeptResdntCnt")
    private Object mdeptResdntCnt;

    @JsonProperty("detySdrCnt")
    private Object detySdrCnt;

    @JsonProperty("cmdcSdrCnt")
    private Object cmdcSdrCnt;

    /** API가 숫자 또는 문자열로 내려줌 */
    @JsonProperty("XPos")
    private Object xPos;

    @JsonProperty("YPos")
    private Object yPos;

    @JsonProperty("distance")
    private String distance;
}
