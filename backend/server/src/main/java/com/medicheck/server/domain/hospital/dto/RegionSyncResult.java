package com.medicheck.server.domain.hospital.dto;

/**
 * 주소 키워드 기준 지역 동기화 결과 (평가·Top5 공통).
 *
 * @param synced    저장/갱신 성공 건수
 * @param attempted HIRA Open API 실제 호출 횟수 (일일 한도 집계용)
 * @param skipped   API 호출 없이 건너뛴 건수 (예: 기존 평가 존재)
 * @param complete  해당 지역 후보를 예산 내에서 모두 처리했으면 true
 */
public record RegionSyncResult(int synced, int attempted, int skipped, boolean complete) {}
