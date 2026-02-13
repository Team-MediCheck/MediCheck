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
     * 너무 큰 결과 집합을 피하기 위해 maxResults 로 상한을 둡니다.
     *
     * @param latitude      사용자 위도 (WGS84)
     * @param longitude     사용자 경도 (WGS84)
     * @param radiusMeters  반경 (미터)
     * @param maxResults    최대 반환 개수
     */
    @Query(value = """
            SELECT  h.*,
                    ST_Distance_Sphere(
                        h.location,
                        ST_SRID(POINT(:longitude, :latitude), 4326)
                    ) AS distance
            FROM hospitals h
            WHERE h.location IS NOT NULL
            HAVING distance <= :radiusMeters
            ORDER BY distance ASC
            LIMIT :maxResults
            """,
            nativeQuery = true)
    List<Hospital> findNearby(
            @Param("latitude") double latitude,
            @Param("longitude") double longitude,
            @Param("radiusMeters") double radiusMeters,
            @Param("maxResults") int maxResults
    );

    /**
     * 근처 병원 ID와 거리만 조회 (거리순). 응답 DTO에 distance를 넣기 위해 사용.
     * 반환: 각 행 [id(Long), distance(Double)]
     */
    @Query(value = """
            SELECT  h.id,
                    ST_Distance_Sphere(
                        h.location,
                        ST_SRID(POINT(:longitude, :latitude), 4326)
                    ) AS distance
            FROM hospitals h
            WHERE h.location IS NOT NULL
            HAVING distance <= :radiusMeters
            ORDER BY distance ASC
            LIMIT :maxResults
            """,
            nativeQuery = true)
    List<Object[]> findNearbyIdAndDistance(
            @Param("latitude") double latitude,
            @Param("longitude") double longitude,
            @Param("radiusMeters") double radiusMeters,
            @Param("maxResults") int maxResults
    );
}

