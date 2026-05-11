package com.medicheck.server.domain.hospital.dto;

import lombok.Builder;
import lombok.Getter;

/**
 * 전국 병원 기본정보 + 평가 + Top5 일괄 동기화 결과.
 */
@Getter
@Builder
public class FullSyncResult {

    private final SyncResult hospitals;

    /** 저장·갱신된 평가 건수 */
    private final int evaluationsSynced;

    /** Top5 API를 호출한 병원 수(ykiho 있는 행 기준) */
    private final int top5HospitalsAttempted;

    /** Top5 저장·갱신에 성공한 병원 수 */
    private final int top5HospitalsSucceeded;

    private final String message;
}
