package com.medicheck.server.domain.hospital.dto;

/**
 * DB 병원을 순회하며 HIRA Top5 API를 호출한 결과 집계.
 */
public record Top5BulkResult(int hospitalsAttempted, int hospitalsSucceeded) {}
