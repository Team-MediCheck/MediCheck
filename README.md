# MediCheck
심평원·건보 공공데이터 기반 안심 병원 찾기 서비스 (LBS Healthcare Platform)

## 로컬 실행

### Backend (Spring Boot)
- 실행 시 `--spring.profiles.active=local` 인자 필수 (`application-local.yaml`의 admin.sync-key 등 사용)
- VS Code: `com.medicheck.server.ServerApplication` Run, args에 `--spring.profiles.active=local` 설정
- IntelliJ: Run Configuration VM options 또는 Program arguments에 `--spring.profiles.active=local` 추가
