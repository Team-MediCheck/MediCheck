package com.medicheck.server.domain.repository;

import com.medicheck.server.domain.entity.Hospital;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * 안심 병원 JPA 리포지토리.
 * 검색/필터는 Specification으로 동적 쿼리.
 */
public interface HospitalRepository extends JpaRepository<Hospital, Long>, JpaSpecificationExecutor<Hospital> {

    Optional<Hospital> findByPublicCode(String publicCode);

    List<Hospital> findAllByPublicCodeIn(Collection<String> publicCodes);
}

