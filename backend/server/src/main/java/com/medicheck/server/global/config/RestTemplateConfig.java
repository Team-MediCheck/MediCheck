package com.medicheck.server.global.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.http.converter.StringHttpMessageConverter;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;

/**
 * RestTemplate 빈 설정.
 * 카카오모빌리티 등 외부 API 호출용.
 */
@Configuration
public class RestTemplateConfig {

    private static final int CONNECT_TIMEOUT_MS = 5_000;
    private static final int READ_TIMEOUT_MS = 10_000;

    private RestTemplate createRestTemplate() {
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(CONNECT_TIMEOUT_MS);
        factory.setReadTimeout(READ_TIMEOUT_MS);
        return new RestTemplate(factory);
    }

    @Bean(name = "kakaoRestTemplate")
    public RestTemplate kakaoRestTemplate() {
        return createRestTemplate();
    }

    /**
     * HIRA Open API 호출용 RestTemplate.
     * 카카오와 동일한 타임아웃(연결 5초, 읽기 10초)을 사용합니다.
     */
    @Bean(name = "hiraRestTemplate")
    public RestTemplate hiraRestTemplate() {
        RestTemplate restTemplate = createRestTemplate();
        // HIRA XML은 charset 헤더 없이 UTF-8로 올 수 있다. 기본 ISO-8859-1로
        // 읽으면 한글이 깨진 상태로 파싱·저장된다. 명시된 응답 charset은 그대로 존중한다.
        restTemplate.getMessageConverters().stream()
                .filter(StringHttpMessageConverter.class::isInstance)
                .map(StringHttpMessageConverter.class::cast)
                .forEach(converter -> converter.setDefaultCharset(StandardCharsets.UTF_8));
        return restTemplate;
    }
}
