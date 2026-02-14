package com.medicheck.server.security;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

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

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.POST, "/api/hospitals/sync", "/api/hospitals/sync/all")
                        .hasRole("ADMIN")
                        .requestMatchers("/api/hospitals/**", "/swagger-ui/**", "/swagger-ui.html",
                                "/v3/api-docs/**", "/error")
                        .permitAll()
                        .anyRequest()
                        .authenticated()
                )
                .addFilterBefore(xAdminKeyAuthFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
