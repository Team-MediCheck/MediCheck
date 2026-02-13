package com.medicheck.server.config;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 기동 시 admin.sync-key(또는 ADMIN_SYNC_KEY)가 비어 있으면 애플리케이션 기동을 실패시킵니다.
 * 예측 가능한 기본값 없이 운영되도록 하여, 프로덕션에서 sync 엔드포인트가 열리는 것을 방지합니다.
 */
@Component
public class AdminSyncKeyValidator {

    @Value("${admin.sync-key:${ADMIN_SYNC_KEY:}}")
    private String adminSyncKey;

    @PostConstruct
    public void validate() {
        if (adminSyncKey == null || adminSyncKey.isBlank()) {
            throw new IllegalStateException(
                    "admin.sync-key (또는 환경변수 ADMIN_SYNC_KEY)가 설정되지 않았습니다. "
                            + "동기화 API를 사용하려면 반드시 비어 있지 않은 값으로 설정한 뒤 기동하세요."
            );
        }
    }
}
