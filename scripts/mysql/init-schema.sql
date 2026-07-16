-- Local MySQL bootstrap for MediCheck (fresh volume only).
-- Mounted at /docker-entrypoint-initdb.d via docker-compose.local.yml

CREATE TABLE IF NOT EXISTS users (
    id BIGINT NOT NULL AUTO_INCREMENT,
    login_id VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(50) NOT NULL,
    nickname VARCHAR(50) NOT NULL,
    created_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_users_login_id (login_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hospitals (
    id BIGINT NOT NULL AUTO_INCREMENT,
    name VARCHAR(200) NOT NULL,
    hosp_name VARCHAR(200) NULL,
    address VARCHAR(500) NULL,
    location GEOMETRY NOT NULL SRID 4326,
    latitude DECIMAL(10, 7) NULL,
    longitude DECIMAL(11, 7) NULL,
    phone VARCHAR(20) NULL,
    public_code VARCHAR(500) NULL,
    ykiho VARCHAR(500) NULL,
    department VARCHAR(100) NULL,
    doctor_total_count INT NULL,
    established_date DATE NULL,
    mdept_specialist_count INT NULL,
    mdept_general_count INT NULL,
    mdept_intern_count INT NULL,
    mdept_resident_count INT NULL,
    dety_specialist_count INT NULL,
    cmdc_specialist_count INT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_hospitals_public_code (public_code),
    SPATIAL INDEX idx_hospitals_location (location)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_favorite_hospitals (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    hospital_id BIGINT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_user_favorite (user_id, hospital_id),
    CONSTRAINT fk_user_favorite_hospitals_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_user_favorite_hospitals_hospital
        FOREIGN KEY (hospital_id) REFERENCES hospitals (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hospital_reviews (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    hospital_id BIGINT NOT NULL,
    rating INT NOT NULL,
    comment VARCHAR(500) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_hospital_reviews_user_hospital (user_id, hospital_id),
    CONSTRAINT fk_hospital_reviews_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_hospital_reviews_hospital
        FOREIGN KEY (hospital_id) REFERENCES hospitals (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hospital_clinic_top5 (
    id BIGINT NOT NULL AUTO_INCREMENT,
    hospital_id BIGINT NOT NULL,
    ykiho VARCHAR(500) NULL,
    crtr_ym VARCHAR(10) NULL,
    disease_nm_1 VARCHAR(100) NULL,
    disease_nm_2 VARCHAR(100) NULL,
    disease_nm_3 VARCHAR(100) NULL,
    disease_nm_4 VARCHAR(100) NULL,
    disease_nm_5 VARCHAR(100) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_hospital_clinic_top5_hospital (hospital_id),
    CONSTRAINT fk_hospital_clinic_top5_hospital
        FOREIGN KEY (hospital_id) REFERENCES hospitals (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hospital_evaluations (
    id BIGINT NOT NULL AUTO_INCREMENT,
    hospital_id BIGINT NOT NULL,
    ykiho VARCHAR(500) NULL,
    yadm_nm VARCHAR(200) NULL,
    cl_cd VARCHAR(10) NULL,
    cl_cd_nm VARCHAR(50) NULL,
    addr VARCHAR(500) NULL,
    asm_grd_01 VARCHAR(20) NULL,
    asm_grd_03 VARCHAR(20) NULL,
    asm_grd_04 VARCHAR(20) NULL,
    asm_grd_05 VARCHAR(20) NULL,
    asm_grd_06 VARCHAR(20) NULL,
    asm_grd_07 VARCHAR(20) NULL,
    asm_grd_08 VARCHAR(20) NULL,
    asm_grd_09 VARCHAR(20) NULL,
    asm_grd_10 VARCHAR(20) NULL,
    asm_grd_12 VARCHAR(20) NULL,
    asm_grd_13 VARCHAR(20) NULL,
    asm_grd_14 VARCHAR(20) NULL,
    asm_grd_15 VARCHAR(20) NULL,
    asm_grd_16 VARCHAR(20) NULL,
    asm_grd_17 VARCHAR(20) NULL,
    asm_grd_18 VARCHAR(20) NULL,
    asm_grd_19 VARCHAR(20) NULL,
    asm_grd_20 VARCHAR(20) NULL,
    asm_grd_21 VARCHAR(20) NULL,
    asm_grd_22 VARCHAR(20) NULL,
    asm_grd_23 VARCHAR(20) NULL,
    asm_grd_24 VARCHAR(20) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_hospital_evaluations_hospital (hospital_id),
    CONSTRAINT fk_hospital_evaluations_hospital
        FOREIGN KEY (hospital_id) REFERENCES hospitals (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
