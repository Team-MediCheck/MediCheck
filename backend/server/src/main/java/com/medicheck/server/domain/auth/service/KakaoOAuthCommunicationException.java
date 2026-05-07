package com.medicheck.server.domain.auth.service;

/**
 * 카카오 OAuth 외부 통신(네트워크/타임아웃/원격 장애) 실패를 표현한다.
 * 클라이언트 입력 오류(인가코드/redirect_uri 불일치)와 구분해 502로 매핑하기 위해 사용한다.
 */
public class KakaoOAuthCommunicationException extends RuntimeException {
    public KakaoOAuthCommunicationException(String message, Throwable cause) {
        super(message, cause);
    }
}
