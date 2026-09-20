# MediCheck

심평원/건보 공공데이터를 활용해 사용자 위치 기반으로 병원을 탐색하고, 길찾기/리뷰/즐겨찾기를 제공하는 헬스케어 웹 서비스입니다.

## 프로젝트 개요

- **목표**: 위치 기반 병원 탐색과 신뢰 가능한 병원 정보 제공
- **아키텍처**: `React + Vite` 프론트엔드, `Spring Boot` 백엔드, `MySQL` 데이터베이스
- **외부 연동**:
  - 카카오맵(JavaScript SDK), 카카오모빌리티 길찾기 API
  - 카카오 OAuth 로그인
  - 건강보험심사평가원(HIRA) Open API
- **배포 방식**: AWS EC2 + Docker Compose (`docker-compose.aws.yml`)

## 주요 기능

- **지도 기반 병원 조회**: 사용자 현재 위치 근처 병원 목록/상세 조회
- **경로 안내**: 출발지-목적지 기준 길찾기 경로/거리/소요 시간 조회
- **회원 기능**: 로그인, 회원가입, 카카오 소셜 로그인
- **리뷰 기능**: 병원 리뷰 조회/작성/수정/삭제
- **즐겨찾기**: 사용자별 관심 병원 저장 및 조회
- **운영 안전장치**:
  - JWT 기반 인증
  - CORS 허용 출처 제어
  - 길찾기 API Rate Limit(IP별 + 전역)

## 기술 스택

- **Frontend**: React 19, TypeScript, Vite, React Router, React Query, Tailwind CSS
- **Backend**: Java 21, Spring Boot 3, Spring Security, Spring Data JPA, Flyway
- **Infra**: Docker, Docker Compose, AWS EC2 (with RDS)

## 저장소 구조

```text
MediCheck/
├─ backend/
│  └─ server/                  # Spring Boot API 서버
├─ frontend/                   # React + Vite 웹 프론트
├─ frontend-expo/              # Expo 관련 리소스
├─ scripts/
│  ├─ ec2/bootstrap.sh         # EC2 초기 설치 스크립트
│  └─ deploy/redeploy.sh       # 다운타임 최소화 재배포 스크립트
├─ docker-compose.aws.yml      # AWS 배포용 Compose
└─ DEPLOY_AWS_DOCKER.md        # AWS 배포 상세 가이드
```

## 빠른 시작 (로컬 개발)

### 0) MySQL 준비 (필수)

`application.yaml` 기준 기본 DB 연결 정보는 아래와 같습니다.

- Host: `localhost`
- Port: `3306`
- DB: `medi_check`
- User: `root`
- Password: `DB_PASSWORD` 환경변수로 주입

로컬에 MySQL이 없다면 Docker로 빠르게 실행할 수 있습니다.

```bash
docker run -d \
  --name medicheck-mysql \
  -e MYSQL_ROOT_PASSWORD=your_local_password \
  -e MYSQL_DATABASE=medi_check \
  -p 3306:3306 \
  mysql:8.4
```

이후 백엔드 실행 전에 `DB_PASSWORD=your_local_password`를 맞춰 주세요.

### 1) 백엔드 실행

```bash
cd backend/server
cp .env.example .env
# .env 에 DB_PASSWORD 등 필요한 값 입력
set -a && source .env && set +a
./gradlew bootRun --args='--spring.profiles.active=local'
```

백엔드 환경변수 핵심:
- 필수: `DB_PASSWORD`, `JWT_SECRET`
- 선택/기능별: `KAKAO_MOBILITY_REST_API_KEY`, `HIRA_SERVICE_KEY`, `KAKAO_OAUTH_REST_API_KEY`, `KAKAO_OAUTH_CLIENT_SECRET`

### 2) 프론트엔드 실행

```bash
cd frontend
cp .env.example .env
# .env 에 VITE_KAKAO_APP_KEY 입력
npm install
npm run dev
```

- 기본 개발 서버: `http://localhost:5173`
- 프론트의 `/api` 요청은 Vite Proxy로 `http://localhost:8080` 백엔드에 전달됩니다.

## 환경변수 정리

### 백엔드 (`backend/server`)

- 템플릿: `.env.example`, `.env.prod.example`
- 운영에서 필수:
  - `SPRING_DATASOURCE_URL`
  - `SPRING_DATASOURCE_USERNAME`
  - `DB_PASSWORD`
  - `JWT_SECRET`
  - `ADMIN_SYNC_KEY`
- 운영 권장:
  - `CORS_ALLOWED_ORIGINS` (예: `https://your-domain.com`)
  - `HIRA_SERVICE_KEY`, `KAKAO_*`

### 프론트엔드 (`frontend`)

- 템플릿: `.env.example`
- 주요 변수:
  - `VITE_KAKAO_APP_KEY`

## AWS + Docker 배포

상세 문서는 `DEPLOY_AWS_DOCKER.md`를 참고하세요.

핵심 절차(EC2 + 외부 MySQL/RDS 기준):

```bash
# 1) EC2 초기 설치 (Ubuntu)
bash scripts/ec2/bootstrap.sh

# 2) 배포용 env 준비
cp .env.aws.example .env.aws
cp backend/server/.env.prod.example backend/server/.env.prod

# 3) 최초 배포
docker compose --env-file .env.aws -f docker-compose.aws.yml up -d --build

# 4) 재배포 (다운타임 최소화)
bash scripts/deploy/redeploy.sh
```

### 배포 시 DB 구성 옵션

- **권장(운영)**: AWS RDS(MySQL) 사용
  - `backend/server/.env.prod`의 `SPRING_DATASOURCE_URL`을 RDS 엔드포인트로 설정
  - 예: `jdbc:mysql://<rds-endpoint>:3306/medi_check?...`
- **대안(단일 EC2 테스트/소규모)**: EC2 내부 MySQL 컨테이너/직접 설치
  - 이 경우에도 `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `DB_PASSWORD`는 반드시 실제 DB와 일치해야 합니다.
  - 단, 운영 안정성/백업/복구 측면에서 RDS 구성을 권장합니다.

## 운영 시 체크 포인트

- 보안그룹: `FRONTEND_PORT`(기본 `8080`)와 `443` 공개, `22`는 운영자 IP로 제한
- DB 접근: RDS는 EC2 보안그룹만 허용
- 시크릿 관리: `.env` 파일은 커밋 금지, 가능하면 AWS SSM/Secrets Manager 사용
- CORS 오류 시 `CORS_ALLOWED_ORIGINS` 값 우선 점검

## 맥미니 GitHub Actions 배포

현재 맥미니 운영 저장소는 `Team-MediCheck/MediCheck`이며,
`medicheck-macmini` self-hosted runner가 `self-hosted`, `macOS`, `ARM64`, `medicheck` 라벨로 연결되어 있습니다.
SSH 키를 GitHub Secrets에 추가할 필요 없이 맥미니의 러너가 배포를 실행합니다.

- 워크플로: `.github/workflows/deploy-macmini.yml` (`Deploy Mac Mini`)
- `main`의 백엔드·웹·배포 코드 변경 시 백엔드 테스트와 웹 빌드가 통과한 뒤 자동 배포합니다.
- Actions → Deploy Mac Mini → Run workflow에서 `deploy`를 해제하면 환경 확인만 수행합니다.
  체크하면 선택한 브랜치의 해당 커밋을 실제 배포합니다.
- 저장소 Actions 변수 `MACMINI_DEPLOY_PATH`로 환경 파일 경로를 지정할 수 있습니다.
  기본값은 `/Users/snowrabbit123/.config/medicheck-deploy`입니다.
- 해당 경로의 `.env.local`, `backend/server/.env.prod`와 실행 중인 MySQL이 필요합니다.
  최초 설정 시 기존 운영 경로에서 환경 파일 두 개를 복사하고 파일 권한은 `600`,
  상위 디렉터리는 `700`으로 설정합니다. 값이 바뀌면 이 배포용 사본도 갱신해야 합니다.
- 커밋된 소스만 `~/.local/share/medicheck/releases/` 폴더에 풀어 빌드합니다.
  macOS 백그라운드 프로세스의 Desktop 접근 문제를 피하도록 환경 파일도 권한 `600`으로 복사합니다.
  운영 체크아웃의 미커밋 파일과 사용자 Docker 인증 설정을 덮어쓰지 않습니다.
- 백엔드·웹 이미지를 모두 빌드한 후 서비스만 교체하고 상태와 API 연결을 확인합니다.
  MySQL·Caddy를 재기동하거나 DB 데이터를 복구하는 작업은 포함하지 않습니다.
- EC2 배포는 저장소 변수 `EC2_DEPLOY_ENABLED=true`일 때만 실행합니다.

PR 검사도 GitHub 호스팅 러너에서 백엔드 테스트와 웹 빌드를 수행합니다.
실제 배포는 잠시 요청이 실패할 수 있는 단일 서버 재기동 방식이며 자동 롤백은 없습니다.
실패 시 Actions 로그와 해당 릴리스 경로를 확인하고 정상 커밋을 수동 배포합니다.

## 증상별 질병명이 `ê…`, `ë…`처럼 깨지는 경우

HIRA Top5 XML 응답에 charset이 없을 때 문자열을 ISO-8859-1로 읽으면,
UTF-8 한글이 깨진 상태로 `hospital_clinic_top5.disease_nm_1`~`disease_nm_5`에 저장될 수 있습니다.
HIRA 전용 HTTP 클라이언트는 charset 미지정 응답의 기본값을 UTF-8로 사용합니다.

운영 데이터 확인·복구 순서:

1. `GET /api/hospitals/search/symptom-keywords` 응답과 아래 DB 조회 결과를 비교합니다.
   DB 값도 깨져 있다면 화면 표시만의 문제가 아닙니다.

   ```sql
   SELECT hospital_id, disease_nm_1, disease_nm_2, disease_nm_3, disease_nm_4, disease_nm_5
   FROM hospital_clinic_top5
   WHERE CONCAT_WS(' ', disease_nm_1, disease_nm_2, disease_nm_3, disease_nm_4, disease_nm_5)
         REGEXP '[À-ÿ�]'
   ORDER BY hospital_id
   LIMIT 100;
   ```

2. 수정된 백엔드를 배포하고 기존 Top5 데이터를 백업합니다.
3. 관리자 헤더 `X-Admin-Key`를 사용하여
   `POST /api/hospitals/sync/top5/one?ykiho=<해당 병원의 요양기호>`로 한 병원을 재동기화한 뒤
   DB 질병명과 API 응답이 정상인지 확인합니다.
4. 정상 확인 후 `POST /api/hospitals/sync/top5/region?addressKeyword=<지역>` 등으로
   영향을 받은 범위를 재동기화합니다. 성공 응답은 기존 병원의 Top5 값을 갱신합니다.
   현재 동기화 구현은 API 오류·응답 없음에도 해당 병원의 기존 Top5를 삭제하므로,
   백업과 소량 검증 후 범위를 확대해야 합니다.
5. 질병명 API를 다시 조회하고 화면을 새로고침합니다.

코드 수정만으로 이미 저장된 문자열이 복구되지는 않습니다.
문자열이 ISO-8859-1 오해석 패턴으로만 손상됐다면 역변환으로 복원할 수도 있지만,
전체 대상의 왕복 변환 검증과 백업 후 적용해야 합니다. 위 조회는 의심 항목을 찾기 위한 조건이며
일치하는 모든 문자열이 손상됐다는 의미는 아닙니다.

## 참고 문서

- 백엔드 상세: `backend/server/README.md`
- AWS 배포 가이드: `DEPLOY_AWS_DOCKER.md`
