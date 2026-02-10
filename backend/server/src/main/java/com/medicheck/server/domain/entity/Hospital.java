package com.medicheck.server.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 안심 병원 엔티티.
 * 심평원·건보 공공데이터 기반 LBS 병원 찾기 서비스의 핵심 도메인.
 */
@Entity
@Table(name = "hospitals")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Hospital {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 병원명 */
    @Column(nullable = false, length = 200)
    private String name;

    /** DB 기존 컬럼(hosp_name) 호환용 — name과 동일 값 저장 */
    @Column(name = "hosp_name", length = 200)
    private String hospName;

    /** 주소 (LBS 검색용) */
    @Column(length = 500)
    private String address;

    /** DB GEOMETRY 컬럼 — 위·경도로 POINT 저장 */
    @Column(name = "location", columnDefinition = "GEOMETRY")
    private Point location;

    /** 위도 */
    @Column(precision = 10, scale = 7)
    private BigDecimal latitude;

    /** 경도 */
    @Column(precision = 11, scale = 7)
    private BigDecimal longitude;

    /** 전화번호 */
    @Column(length = 20)
    private String phone;

    /** 심평원/건보 공공데이터 연동용 코드(암호화 요양기호 등) */
    @Column(name = "public_code", unique = true, length = 500)
    private String publicCode;

    /** DB 기존 컬럼(ykiho) 호환용 — publicCode와 동일 값 저장 */
    @Column(name = "ykiho", length = 500)
    private String ykiho;

    /** 진료과 (예: 내과, 외과) */
    @Column(length = 100)
    private String department;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Builder
    public Hospital(
            String name,
            String address,
            BigDecimal latitude,
            BigDecimal longitude,
            String phone,
            String publicCode,
            String department
    ) {
        this.name = name;
        this.hospName = name;
        this.address = address;
        this.location = toPoint(longitude, latitude);
        this.latitude = latitude;
        this.longitude = longitude;
        this.phone = phone;
        this.publicCode = publicCode;
        this.ykiho = publicCode;
        this.department = department;
    }

    @PrePersist
    void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    private static final GeometryFactory GEOMETRY_FACTORY = new GeometryFactory(new PrecisionModel(), 4326);

    private static Point toPoint(BigDecimal longitude, BigDecimal latitude) {
        if (longitude == null || latitude == null) return null;
        return GEOMETRY_FACTORY.createPoint(new Coordinate(
                longitude.doubleValue(),
                latitude.doubleValue()
        ));
    }
}
