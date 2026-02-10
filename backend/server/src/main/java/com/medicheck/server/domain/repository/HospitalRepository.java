package com.medicheck.server.domain.repository;

import com.medicheck.server.domain.entity.Hospital;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * 안심 병원 JPA 리포지토리.
 */
public interface HospitalRepository extends JpaRepository<Hospital, Long> {

    Optional<Hospital> findByPublicCode(String publicCode);
}
