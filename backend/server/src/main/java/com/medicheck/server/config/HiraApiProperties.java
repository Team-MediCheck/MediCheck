package com.medicheck.server.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import lombok.Getter;
import lombok.Setter;

/**
 * 건강보험심사평가원 병원정보 Open API 설정.
 * ServerApplication 의 @EnableConfigurationProperties 로 등록됨.
 */
@ConfigurationProperties(prefix = "hira.api")
@Getter
@Setter
public class HiraApiProperties {

    /** API 기본 URL (포털 개발계정: hospInfoServicev2) */
    private String baseUrl = "https://apis.data.go.kr/B551182/hospInfoServicev2";

    /** 공공데이터포털에서 발급받은 서비스 인증키 (항상 디코딩된 원본 값 사용) */
    private String serviceKey = "";
}
