package com.medicheck.server.domain.repository;

import com.medicheck.server.domain.entity.Hospital;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

import jakarta.persistence.criteria.Predicate;

/**
 * 병원 목록 검색/필터용 Specification.
 */
public final class HospitalSpecification {

    private static final char LIKE_ESCAPE = '\\';

    private HospitalSpecification() {
    }

    /**
     * LIKE 패턴에서 와일드카드 '%', '_' 및 이스케이프 문자 '\'를 이스케이프합니다.
     * 순서: 백슬래시 먼저, 그다음 '%', '_'.
     */
    private static String escapeForLike(String literal) {
        return literal
                .replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_");
    }

    /**
     * 키워드 검색: 병원명, 주소, 진료과에 LIKE %keyword% 적용.
     * 사용자 입력의 '%', '_'는 리터럴로 취급됩니다.
     */
    public static Specification<Hospital> hasKeyword(String keyword) {
        if (!StringUtils.hasText(keyword)) {
            return (root, query, cb) -> cb.conjunction();
        }
        String pattern = "%" + escapeForLike(keyword.trim()) + "%";
        String patternLower = pattern.toLowerCase();
        return (root, query, cb) -> {
            Predicate name = cb.like(cb.lower(root.get("name")), patternLower, LIKE_ESCAPE);
            Predicate address = cb.like(cb.lower(root.get("address")), patternLower, LIKE_ESCAPE);
            Predicate dept = cb.like(cb.lower(root.get("department")), patternLower, LIKE_ESCAPE);
            return cb.or(name, address, dept);
        };
    }

    /**
     * 진료과 필터: department가 주어진 값과 일치(포함).
     * 사용자 입력의 '%', '_'는 리터럴로 취급됩니다.
     */
    public static Specification<Hospital> hasDepartment(String department) {
        if (!StringUtils.hasText(department)) {
            return (root, query, cb) -> cb.conjunction();
        }
        String pattern = "%" + escapeForLike(department.trim()) + "%";
        return (root, query, cb) ->
                cb.like(cb.lower(root.get("department")), pattern.toLowerCase(), LIKE_ESCAPE);
    }

    /**
     * keyword + department 조건을 하나의 Specification으로 합칩니다.
     */
    public static Specification<Hospital> withFilters(String keyword, String department) {
        return hasKeyword(keyword).and(hasDepartment(department));
    }
}
