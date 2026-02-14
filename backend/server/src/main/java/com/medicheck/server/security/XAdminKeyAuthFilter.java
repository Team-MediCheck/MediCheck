package com.medicheck.server.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;

/**
 * 모든 요청에 대해 X-Admin-Key 헤더를 검사합니다.
 * 헤더가 존재하고 admin.sync-key와 일치하면 ROLE_ADMIN을 부여하고,
 * 그렇지 않으면 인증을 설정하지 않습니다.
 * 접근 제어(hasRole("ADMIN"))는 SecurityConfig에 위임됩니다.
 */
@Component
public class XAdminKeyAuthFilter extends OncePerRequestFilter {

    private static final String ADMIN_KEY_HEADER = "X-Admin-Key";
    private static final String ROLE_ADMIN = "ROLE_ADMIN";

    @Value("${admin.sync-key:${ADMIN_SYNC_KEY:}}")
    private String adminSyncKey;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String key = request.getHeader(ADMIN_KEY_HEADER);
        if (adminSyncKey != null && !adminSyncKey.isBlank() && key != null && adminSyncKey.equals(key)) {
            var auth = new UsernamePasswordAuthenticationToken(
                    "admin",
                    null,
                    Collections.singletonList(new SimpleGrantedAuthority(ROLE_ADMIN))
            );
            SecurityContextHolder.getContext().setAuthentication(auth);
        }
        filterChain.doFilter(request, response);
    }
}
