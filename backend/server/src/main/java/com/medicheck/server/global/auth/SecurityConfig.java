package com.medicheck.server.global.auth;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Spring Security 설정.
 * - 공개 API(병원 목록/상세/근처, Swagger UI): permitAll
 * - 동기화 API(POST /api/hospitals/sync*): ROLE_ADMIN 필요 (X-Admin-Key 헤더 검증)
 */
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final XAdminKeyAuthFilter xAdminKeyAuthFilter;
    private final PerIPDirectionsRateLimitFilter perIPDirectionsRateLimitFilter;
    private final JwtAuthFilter jwtAuthFilter;

    /**
     * {@code CORS_ALLOWED_ORIGINS}가 비어 있으면 출처 허용 없음(브라우저 크로스 오리진 차단).
     * 운영에서는 {@code https://your-cloudfront...} 형태로 쉼표 구분해 설정합니다.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource(
            @Value("${app.cors.allowed-origins:}") String rawOrigins
    ) {
        if (rawOrigins == null || rawOrigins.isBlank()) {
            return request -> null;
        }
        List<String> patterns = Arrays.stream(rawOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toList());
        if (patterns.isEmpty()) {
            return request -> null;
        }
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOriginPatterns(patterns);
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setExposedHeaders(List.of("Authorization", "Content-Type"));
        configuration.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(Customizer.withDefaults())
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.POST,
                                "/api/hospitals/sync",
                                "/api/hospitals/sync/all",
                                "/api/hospitals/sync/full",
                                "/api/hospitals/sync/region",
                                "/api/hospitals/sync/location",
                                "/api/hospitals/sync/evaluations",
                                "/api/hospitals/sync/evaluations/one",
                                "/api/hospitals/sync/evaluations/region",
                                "/api/hospitals/sync/top5/all",
                                "/api/hospitals/sync/top5/one",
                                "/api/hospitals/sync/top5/region")
                        .hasRole("ADMIN")
                        // 내 리뷰 조회는 인증 필요 (permitAll보다 먼저 매칭)
                        .requestMatchers(HttpMethod.GET, "/api/hospitals/*/reviews/me")
                        .authenticated()
                        // 병원 목록/상세/리뷰 목록 등 공개 GET
                        .requestMatchers(HttpMethod.GET, "/api/hospitals/**")
                        .permitAll()
                        .requestMatchers(
                                "/api/auth/login",
                                "/api/auth/signup",
                                "/api/auth/kakao/authorize",
                                "/api/auth/login/kakao",
                                "/api/auth/login/kakao/native",
                                "/api/directions/**",
                                "/actuator/health",
                                "/swagger-ui/**",
                                "/swagger-ui.html",
                                "/v3/api-docs/**",
                                "/error"
                        )
                        .permitAll()
                        .anyRequest()
                        .authenticated()
                )
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(perIPDirectionsRateLimitFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(xAdminKeyAuthFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
