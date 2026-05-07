package com.medicheck.server.domain.auth.service;

import com.medicheck.server.global.config.KakaoOAuthProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

/**
 * 카카오 OAuth2 로그인 연동 서비스.
 * 인가 코드 → 액세스 토큰 → 사용자 정보 조회를 담당합니다.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class KakaoOAuthService {

    private static final String TOKEN_URL = "https://kauth.kakao.com/oauth/token";
    private static final String USER_INFO_URL = "https://kapi.kakao.com/v2/user/me";

    private final KakaoOAuthProperties props;

    @Qualifier("kakaoRestTemplate")
    private final RestTemplate kakaoRestTemplate;

    /**
     * 인가 코드로 카카오 사용자 정보를 조회합니다.
     *
     * @param code        Kakao authorization code
     * @param redirectUri Kakao에 등록된 redirect_uri (프론트에서 사용한 값과 동일해야 함)
     */
    public KakaoUserInfo getUserInfo(String code, String redirectUri) {
        if (code == null || code.isBlank()) {
            throw new IllegalArgumentException("카카오 로그인 코드가 없습니다.");
        }
        if (props.getRestApiKey() == null || props.getRestApiKey().isBlank()) {
            throw new IllegalStateException("카카오 로그인 REST API 키가 설정되지 않았습니다. kakao.oauth.rest-api-key를 확인하세요.");
        }

        try {
            log.info("Kakao token exchange start: redirectUri={}, codeLength={}", redirectUri, code.length());
            String accessToken = fetchAccessToken(code, redirectUri);
            return fetchUserInfo(accessToken);
        } catch (HttpStatusCodeException e) {
            String responseBody = e.getResponseBodyAsString();
            log.warn("Kakao API error: status={}, body={}", e.getStatusCode(), responseBody);
            throw new IllegalArgumentException("카카오 로그인 토큰 교환에 실패했습니다. redirect_uri/code 값을 확인해 주세요.");
        } catch (RestClientException e) {
            log.warn("Kakao API communication error", e);
            throw new KakaoOAuthCommunicationException("카카오 로그인 통신 중 오류가 발생했습니다.", e);
        }
    }

    private String fetchAccessToken(String code, String redirectUri) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("grant_type", "authorization_code");
        params.add("client_id", props.getRestApiKey());
        params.add("code", code);
        if (redirectUri != null && !redirectUri.isBlank()) {
            params.add("redirect_uri", redirectUri);
        }
        if (props.getClientSecret() != null && !props.getClientSecret().isBlank()) {
            params.add("client_secret", props.getClientSecret());
        }

        HttpEntity<MultiValueMap<String, String>> entity = new HttpEntity<>(params, headers);
        @SuppressWarnings("unchecked")
        Map<String, Object> body = kakaoRestTemplate.postForObject(TOKEN_URL, entity, Map.class);
        if (body != null && body.get("error") != null) {
            String error = String.valueOf(body.get("error"));
            Object descriptionObj = body.get("error_description");
            String description = descriptionObj == null ? "" : String.valueOf(descriptionObj);
            log.warn("Kakao token response error: error={}, description={}", error, description);
            throw new IllegalArgumentException(
                    "카카오 토큰 응답 오류: " + error + (description.isBlank() ? "" : " (" + description + ")"));
        }
        if (body == null || body.get("access_token") == null) {
            throw new IllegalArgumentException("카카오 액세스 토큰을 가져오지 못했습니다.");
        }
        return String.valueOf(body.get("access_token"));
    }

    private KakaoUserInfo fetchUserInfo(String accessToken) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        HttpEntity<Void> entity = new HttpEntity<>(headers);

        @SuppressWarnings("unchecked")
        Map<String, Object> body = kakaoRestTemplate.postForObject(USER_INFO_URL, entity, Map.class);
        if (body == null || body.get("id") == null) {
            throw new IllegalArgumentException("카카오 사용자 정보를 가져오지 못했습니다.");
        }

        String id = String.valueOf(body.get("id"));
        String nickname = "";

        Object accountObj = body.get("kakao_account");
        if (accountObj instanceof Map<?, ?> account) {
            Object profileObj = account.get("profile");
            if (profileObj instanceof Map<?, ?> profile) {
                Object nick = profile.get("nickname");
                if (nick != null) {
                    nickname = String.valueOf(nick);
                }
            }
        }

        return new KakaoUserInfo(id, nickname);
    }

    /**
     * 카카오 사용자 정보 최소값.
     */
    public record KakaoUserInfo(String id, String nickname) {
    }
}

