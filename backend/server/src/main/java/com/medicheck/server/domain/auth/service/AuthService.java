package com.medicheck.server.domain.auth.service;

import com.medicheck.server.domain.user.entity.User;
import com.medicheck.server.domain.user.repository.UserRepository;
import com.medicheck.server.global.auth.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final KakaoOAuthService kakaoOAuthService;

    @Transactional
    public String signup(String loginId, String rawPassword, String name) {
        String normalizedLoginId = loginId == null ? "" : loginId.trim();
        if (userRepository.existsByLoginId(normalizedLoginId)) {
            throw new IllegalArgumentException("이미 사용 중인 아이디입니다.");
        }
        String hash = passwordEncoder.encode(rawPassword);
        User user = User.builder()
                .loginId(normalizedLoginId)
                .email(buildInternalEmail(normalizedLoginId))
                .passwordHash(hash)
                .name(name != null ? name.trim() : "")
                .build();
        user = userRepository.save(user);
        return jwtService.createToken(normalizedLoginId, user.getId());
    }

    public String login(String loginId, String rawPassword) {
        String normalizedLoginId = loginId == null ? "" : loginId.trim();
        User user = userRepository.findByLoginId(normalizedLoginId)
                .orElseThrow(() -> new IllegalArgumentException("아이디 또는 비밀번호가 올바르지 않습니다."));
        if (!passwordEncoder.matches(rawPassword, user.getPasswordHash())) {
            throw new IllegalArgumentException("아이디 또는 비밀번호가 올바르지 않습니다.");
        }
        return jwtService.createToken(normalizedLoginId, user.getId());
    }

    /**
     * 현재 로그인 사용자를 조회합니다.
     *
     * @param loginId SecurityContext 에서 가져온 로그인 ID
     * @return User 엔티티
     * @throws IllegalArgumentException 사용자를 찾을 수 없는 경우
     */
    @Transactional(readOnly = true)
    public User getCurrentUser(String loginId) {
        return userRepository.findByLoginId(loginId)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
    }

    /**
     * 카카오 OAuth 인가 코드로 로그인 처리.
     * 외부 카카오 호출은 트랜잭션 밖에서 수행하고, 사용자 생성/조회만 트랜잭션 안에서 처리합니다.
     */
    public String loginWithKakaoCode(String code, String redirectUri) {
        KakaoOAuthService.KakaoUserInfo info = kakaoOAuthService.getUserInfo(code, redirectUri);
        String kakaoLoginId = "kakao_" + info.id();
        String nickname = info.nickname() != null ? info.nickname().trim() : "";
        return ensureKakaoUserAndGetToken(kakaoLoginId, nickname);
    }

    /**
     * 카카오 네이티브 SDK 액세스 토큰으로 로그인 처리.
     */
    public String loginWithKakaoAccessToken(String accessToken) {
        KakaoOAuthService.KakaoUserInfo info = kakaoOAuthService.getUserInfoByAccessToken(accessToken);
        String kakaoLoginId = "kakao_" + info.id();
        String nickname = info.nickname() != null ? info.nickname().trim() : "";
        return ensureKakaoUserAndGetToken(kakaoLoginId, nickname);
    }

    /**
     * 카카오 로그인용 사용자를 생성하거나 기존 사용자를 조회한 뒤 토큰을 발급합니다.
     * 동시 요청에 의한 중복 생성 시 DataIntegrityViolationException 을 잡고 재조회합니다.
     */
    @Transactional
    protected String ensureKakaoUserAndGetToken(String kakaoLoginId, String nickname) {
        return userRepository.findByLoginId(kakaoLoginId)
                .map(user -> jwtService.createToken(user.getLoginId(), user.getId()))
                .orElseGet(() -> {
                    try {
                        String randomPassword = UUID.randomUUID().toString();
                        String hash = passwordEncoder.encode(randomPassword);
                        User user = User.builder()
                                .loginId(kakaoLoginId)
                                .email(buildInternalEmail(kakaoLoginId))
                                .passwordHash(hash)
                                .name(nickname)
                                .build();
                        user = userRepository.save(user);
                        return jwtService.createToken(user.getLoginId(), user.getId());
                    } catch (DataIntegrityViolationException ex) {
                        // 동시성으로 인해 이미 생성된 경우 재조회
                        return userRepository.findByLoginId(kakaoLoginId)
                                .map(user -> jwtService.createToken(user.getLoginId(), user.getId()))
                                .orElseThrow(() -> ex);
                    }
                });
    }

    /**
     * 실제 이메일을 받지 않으므로 내부용 이메일 값을 생성한다.
     * 기존 DB의 NOT NULL 제약을 만족시키기 위한 용도.
     */
    private String buildInternalEmail(String baseId) {
        String trimmed = baseId == null ? "" : baseId.trim();
        if (trimmed.isEmpty()) {
            trimmed = "user";
        }
        return trimmed + "@local.medicheck";
    }
}
