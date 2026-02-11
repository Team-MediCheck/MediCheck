package com.medicheck.server.domain.repository;

import com.medicheck.server.domain.entity.Hospital;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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

    /**
     * 사용자의 위도/경도에서 주어진 반경(m) 안에 있는 병원을 거리 오름차순으로 조회합니다.
     * MySQL 8+의 ST_Distance_Sphere, POINT, ST_SRID 를 사용합니다.
     *
     * @param latitude      사용자 위도 (WGS84)
     * @param longitude     사용자 경도 (WGS84)
     * @param radiusMeters  반경 (미터)
     */
    @Query(value = """
            SELECT *
            FROM hospitals h
            WHERE ST_Distance_Sphere(
                      h.location,
                      ST_SRID(POINT(:longitude, :latitude), 4326)
                  ) <= :radiusMeters
            ORDER BY ST_Distance_Sphere(
                      h.location,
                      ST_SRID(POINT(:longitude, :latitude), 4326)
                  ) ASC
            """,
            nativeQuery = true)
    List<Hospital> findNearby(
            @Param("latitude") double latitude,
            @Param("longitude") double longitude,
            @Param("radiusMeters") double radiusMeters
    );
}

