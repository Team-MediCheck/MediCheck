package com.medicheck.server.domain.auth.controller;

import com.medicheck.server.global.config.KakaoOAuthProperties;
import com.medicheck.server.domain.user.entity.User;
import com.medicheck.server.domain.auth.service.AuthService;
import com.medicheck.server.domain.auth.service.KakaoOAuthCommunicationException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = "04. 인증·회원", description = "회원가입, 로그인, 카카오 OAuth, 내 정보")
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Slf4j
public class AuthController {

    private final AuthService authService;
    private final KakaoOAuthProperties kakaoOAuthProperties;

    @Operation(summary = "회원가입", description = "loginId, password, name(선택)으로 가입합니다. 성공 시 JWT token을 반환합니다. 비밀번호 8자 이상.")
    @PostMapping("/signup")
    public ResponseEntity<Map<String, Object>> signup(@RequestBody Map<String, String> body) {
        String loginId = body.get("loginId");
        String password = body.get("password");
        String name = body.get("name");
        if (loginId == null || loginId.isBlank() || password == null || password.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "invalid_input", "message", "아이디와 비밀번호를 입력하세요."));
        }
        if (loginId.length() < 2 || loginId.length() > 50) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "invalid_login_id", "message", "아이디는 2~50자로 입력하세요."));
        }
        if (password.length() < 8) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "invalid_password", "message", "비밀번호는 8자 이상이어야 합니다."));
        }
        try {
            String token = authService.signup(loginId, password, name != null ? name : "");
            return ResponseEntity.ok(Map.of("token", token, "message", "회원가입이 완료되었습니다."));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "signup_failed", "message", e.getMessage()));
        }
    }

    @Operation(summary = "로그인", description = "loginId, password로 로그인합니다. 성공 시 JWT token을 반환합니다.")
    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody Map<String, String> body) {
        String loginId = body.get("loginId");
        String password = body.get("password");
        if (loginId == null || loginId.isBlank() || password == null || password.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "invalid_input", "message", "아이디와 비밀번호를 입력하세요."));
        }
        try {
            String token = authService.login(loginId, password);
            return ResponseEntity.ok(Map.of("token", token));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(401)
                    .body(Map.of("error", "login_failed", "message", e.getMessage()));
        }
    }

    @Operation(summary = "카카오 로그인 시작", description = "redirectUri를 받아 카카오 인가 페이지로 리다이렉트합니다. REST API 키는 서버 설정값을 사용합니다.")
    @GetMapping("/kakao/authorize")
    public ResponseEntity<Void> kakaoAuthorize(@RequestParam String redirectUri) {
        String restApiKey = kakaoOAuthProperties.getRestApiKey();
        if (restApiKey == null || restApiKey.isBlank()) {
            log.warn("Kakao authorize blocked: missing rest api key");
            return ResponseEntity.status(503).build();
        }
        if (redirectUri == null || redirectUri.isBlank()) {
            log.warn("Kakao authorize blocked: empty redirectUri");
            return ResponseEntity.badRequest().build();
        }
        String resolvedRedirectUri = resolveAllowedRedirectUri(redirectUri, kakaoOAuthProperties.getAllowedRedirectUris());
        if (resolvedRedirectUri == null) {
            log.warn("Kakao authorize blocked: disallowed redirectUri={}", redirectUri);
            return ResponseEntity.status(403).build();
        }
        String location = "https://kauth.kakao.com/oauth/authorize?client_id="
                + URLEncoder.encode(restApiKey, StandardCharsets.UTF_8)
                + "&redirect_uri="
                + URLEncoder.encode(resolvedRedirectUri, StandardCharsets.UTF_8)
                + "&response_type=code";
        log.info("Kakao authorize redirect prepared: redirectUri={}", resolvedRedirectUri);
        return ResponseEntity.status(302).header(HttpHeaders.LOCATION, location).build();
    }

    private String resolveAllowedRedirectUri(String redirectUri, List<String> allowedRedirectUris) {
        if (allowedRedirectUris == null || allowedRedirectUris.isEmpty()) {
            log.error("Kakao OAuth allowed redirect URIs are empty. Check kakao.oauth.allowed-redirect-uris configuration.");
            return null;
        }
        URI requestedUri = parseAndNormalizeUri(redirectUri);
        if (requestedUri == null) {
            return null;
        }
        return allowedRedirectUris.stream()
                .filter(value -> value != null && !value.isBlank())
                .filter(value -> {
                    URI allowed = parseAndNormalizeUri(value);
                    return allowed != null && allowed.equals(requestedUri);
                })
                .findFirst()
                .map(String::trim)
                .orElse(null);
    }

    private URI parseAndNormalizeUri(String value) {
        try {
            URI uri = URI.create(value.trim()).normalize();
            if (!uri.isAbsolute() || uri.getHost() == null) {
                return null;
            }
            String scheme = uri.getScheme();
            if (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)) {
                return null;
            }
            if (uri.getFragment() != null) {
                return null;
            }
            int port = uri.getPort();
            if (port == -1) {
                port = "https".equalsIgnoreCase(scheme) ? 443 : 80;
            }
            String path = (uri.getPath() == null || uri.getPath().isBlank()) ? "/" : uri.getPath();
            return URI.create(String.format("%s://%s:%d%s%s",
                    scheme.toLowerCase(),
                    uri.getHost().toLowerCase(),
                    port,
                    path,
                    uri.getQuery() == null ? "" : "?" + uri.getQuery()));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /**
     * 카카오 로그인 콜백 처리.
     * 프론트엔드에서 받은 인가 코드를 넘겨주면 JWT 토큰을 발급합니다.
     */
    @Operation(summary = "카카오 로그인", description = "프론트에서 받은 인가 code와 redirectUri로 카카오 토큰 교환 후 JWT를 발급합니다.")
    @PostMapping("/login/kakao")
    public ResponseEntity<Map<String, Object>> kakaoLogin(@RequestBody Map<String, String> body) {
        String code = body.get("code");
        String redirectUri = body.get("redirectUri");
        if (code == null || code.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "invalid_input", "message", "카카오 로그인 코드가 없습니다."));
        }
        if (redirectUri == null || redirectUri.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "invalid_input", "message", "카카오 로그인 redirectUri가 없습니다."));
        }
        String resolvedRedirectUri = resolveAllowedRedirectUri(redirectUri, kakaoOAuthProperties.getAllowedRedirectUris());
        if (resolvedRedirectUri == null) {
            log.warn("Kakao login blocked: disallowed redirectUri={}", redirectUri);
            return ResponseEntity.status(403)
                    .body(Map.of("error", "forbidden_redirect_uri", "message", "허용되지 않은 redirectUri 입니다."));
        }
        try {
            log.info("Kakao login requested: redirectUri={}, codeLength={}", resolvedRedirectUri, code.length());
            String token = authService.loginWithKakaoCode(code, resolvedRedirectUri);
            return ResponseEntity.ok(Map.of("token", token));
        } catch (IllegalStateException e) {
            log.error("Kakao login config error: redirectUri={}", resolvedRedirectUri, e);
            return ResponseEntity.status(503)
                    .body(Map.of("error", "kakao_config_error", "message", e.getMessage()));
        } catch (KakaoOAuthCommunicationException e) {
            log.error("Kakao login upstream communication error: redirectUri={}", resolvedRedirectUri, e);
            return ResponseEntity.status(502)
                    .body(Map.of("error", "kakao_upstream_error", "message", e.getMessage()));
        } catch (IllegalArgumentException e) {
            log.warn("Kakao login failed: redirectUri={}, reason={}", resolvedRedirectUri, e.getMessage());
            return ResponseEntity.status(401)
                    .body(Map.of("error", "kakao_login_failed", "message", e.getMessage()));
        }
    }

    @Operation(summary = "카카오 네이티브 로그인", description = "프론트 네이티브 SDK에서 받은 accessToken으로 사용자 정보를 조회해 JWT를 발급합니다.")
    @PostMapping("/login/kakao/native")
    public ResponseEntity<Map<String, Object>> kakaoNativeLogin(@RequestBody Map<String, String> body) {
        String accessToken = body.get("accessToken");
        if (accessToken == null || accessToken.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "invalid_input", "message", "카카오 액세스 토큰이 없습니다."));
        }
        try {
            log.info("Kakao native login requested: accessTokenLength={}", accessToken.length());
            String token = authService.loginWithKakaoAccessToken(accessToken);
            return ResponseEntity.ok(Map.of("token", token));
        } catch (IllegalStateException e) {
            log.error("Kakao native login config error", e);
            return ResponseEntity.status(503)
                    .body(Map.of("error", "kakao_config_error", "message", e.getMessage()));
        } catch (KakaoOAuthCommunicationException e) {
            log.error("Kakao native login upstream communication error", e);
            return ResponseEntity.status(502)
                    .body(Map.of("error", "kakao_upstream_error", "message", e.getMessage()));
        } catch (IllegalArgumentException e) {
            log.warn("Kakao native login failed: reason={}", e.getMessage());
            return ResponseEntity.status(401)
                    .body(Map.of("error", "kakao_login_failed", "message", e.getMessage()));
        }
    }

    @Operation(summary = "내 정보", description = "Authorization: Bearer JWT로 로그인한 사용자의 loginId, name, userId를 반환합니다.")
    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> me(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) {
            Map<String, Object> err = new HashMap<>();
            err.put("error", "unauthorized");
            return ResponseEntity.status(401).body(err);
        }
        try {
            User u = authService.getCurrentUser(auth.getName());
            Map<String, Object> body = new HashMap<>();
            body.put("loginId", u.getLoginId());
            body.put("name", u.getName());
            body.put("userId", u.getId());
            return ResponseEntity.ok(body);
        } catch (IllegalArgumentException e) {
            Map<String, Object> err = new HashMap<>();
            err.put("error", "unauthorized");
            return ResponseEntity.status(401).body(err);
        }
    }

    @Operation(
            summary = "회원 탈퇴",
            description = "로그인한 계정을 삭제합니다. 즐겨찾기·작성 리뷰도 함께 삭제됩니다. 복구할 수 없습니다."
    )
    @DeleteMapping("/me")
    public ResponseEntity<?> deleteMe(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) {
            Map<String, Object> err = new HashMap<>();
            err.put("error", "unauthorized");
            return ResponseEntity.status(401).body(err);
        }
        try {
            authService.deleteCurrentUser(auth.getName());
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            Map<String, Object> err = new HashMap<>();
            err.put("error", "unauthorized");
            return ResponseEntity.status(401).body(err);
        }
    }
}
