# Neon Database Setup Design

기준일: 2026-03-28

## 목적

이 프로젝트의 PostgreSQL 연결 구성을 `Neon` 기준으로 통일한다.

이번 설계의 목표는 다음과 같다.

- 개발 환경과 운영 환경이 같은 DB 제품군과 연결 규칙을 사용한다.
- 공개 MVP 기준에서 로컬 실행, 수동 배치, 추후 상시 서버 배치까지 같은 원칙으로 확장 가능해야 한다.
- 연결 설정이 단순해야 하고, 운영 시 재설정 비용이 작아야 한다.
- 현재 코드 구조를 크게 흔들지 않고 적용 가능해야 한다.

## 현재 상태

현재 프로젝트는 `pg` 패키지를 직접 사용하고 있으며, 다음 특성이 있다.

- DB 연결 문자열은 `DATABASE_URL` 하나만 사용한다.
- TLS 사용 여부는 `DB_SSL` 환경변수로 제어한다.
- API 서버와 CLI 배치가 같은 연결 규칙을 공유한다.
- `.env` 자동 로딩이 없어 실행 전에 shell export를 수동으로 해야 한다.
- 배치는 `npm run batch:daily` 형태의 CLI 실행을 전제로 한다.

이 구조는 로컬 Postgres나 일반 관리형 Postgres에는 충분하지만, 공개 MVP 기준의 Neon 운영 규칙을 반영하기에는 부족하다.

## 설계 결정

### 1. DB 제품 선택

이 프로젝트의 기본 DB는 `Neon Postgres`로 통일한다.

선정 이유:

- 데이터 구조가 `상품/오퍼/스냅샷` 중심이라 관계형 모델과 Postgres가 가장 잘 맞는다.
- 초기 트래픽이 낮고 배치성 적재가 포함되므로 usage-based 비용 구조가 유리하다.
- 개발/프리뷰 환경에서 branching 이점을 활용할 수 있다.
- 로컬 개발부터 공개 MVP까지 같은 연결 방식으로 가져가기 쉽다.

### 2. 연결 원칙

기본 원칙은 `평소에는 pooled, 관리 작업만 direct`이다.

- `DATABASE_URL`
  - Neon pooled connection string
  - API 서버, 로컬 수동 배치, 추후 상시 서버 cron 배치에서 사용
- `DATABASE_URL_DIRECT`
  - Neon direct connection string
  - `db:init` 같은 관리성 작업이나 향후 세션 성격 작업에서만 사용

이 결정은 Neon 공식 문서의 권장과 맞춘다.
Neon은 pooled와 direct 연결을 모두 제공하며, 애플리케이션이 동시 연결을 많이 만들 수 있으면 pooled 연결을 권장한다. 또한 pooled 연결 문자열은 호스트명에 `-pooler`가 포함된다. [Connecting to Neon](https://neon.com/docs/get-started-with-neon/connect-neon) [Glossary](https://neon.com/docs/reference/glossary/)

### 3. 클라이언트 방식

현재의 단건 `Client` 생성 방식 대신, 공유 `Pool` 기반 연결 방식으로 전환한다.

이유:

- 공개 MVP에서는 API 요청과 배치 실행이 반복되므로 단건 연결 생성보다 안정적이다.
- 상시 서버로 이전할 때도 같은 접근을 유지할 수 있다.
- pooled connection과 더 자연스럽게 맞는다.

단, direct 연결이 필요한 관리 작업은 별도 direct client 생성 경로를 둔다.

### 4. 환경변수 로딩

앱과 CLI 스크립트가 `.env`를 자동으로 읽도록 공통 로더를 추가한다.

이 결정의 목적은 다음과 같다.

- 로컬 개발 시 매번 수동 export를 하지 않게 한다.
- API 서버와 배치 스크립트의 실행 조건을 일관되게 맞춘다.
- 운영 환경에서는 기존처럼 실제 환경변수를 우선 사용하게 한다.

### 5. TLS 정책

Neon 연결은 TLS 사용을 기본값으로 본다.

- pooled/direct URL에 `sslmode=require`가 포함되어 있으면 그대로 사용한다.
- 필요 시 `DB_SSL=false`로 로컬 예외를 둘 수는 있지만, 기본 문서와 예제는 Neon 기준 TLS 전제를 따른다.

### 6. 리전 선택

한국 대상 서비스 기준 권장 리전은 `AWS Asia Pacific (Singapore)`로 둔다.

근거:

- Neon 공식 지원 리전 중 한국과 가장 가까운 아시아 리전이다.
- Neon은 사용자 위치가 아니라 애플리케이션 서버와 가까운 리전을 권장한다.
- 현재 지원 리전에 서울은 없다. [Regions](https://neon.com/docs/conceptual-guides/regions)

이 프로젝트는 MVP 공개 시점에 Render/Railway 같은 상시 서버를 함께 검토할 예정이므로, 서버 리전도 가능하면 싱가포르에 맞추는 것이 바람직하다.

### 7. 공개 MVP 운영 원칙

Neon은 기본적으로 유휴 시 자동 절전(scale-to-zero)되는 구조이지만, 공개 운영용 DB가 서비스용으로 부적합한 것은 아니다.

- 개발/스테이징에서는 autosuspend를 켜도 된다.
- 공개 MVP 운영 브랜치는 `Launch` 플랜에서 autosuspend를 끄고 always-on으로 운영하는 것을 권장한다.

Neon 가격 문서는 유휴 DB가 5분 후 inactive 상태가 되고, intermittent load 예시에서는 필요 시 약 350ms 내 재시작한다고 설명한다. 같은 문서에서 24/7로 유지되는 low-load 예시도 함께 제공한다. [Pricing](https://neon.com/pricing)

## 구현 범위

### 수정 파일

- `src/db/database-url.ts`
- `src/db/pg-client.ts`
- `src/db/check-connection.ts`
- `src/db/init-schema.ts`
- `src/main.ts`
- `.env.example`
- `README.md`

### 추가 파일

- `src/db/load-env.ts`
- `src/db/database-url.spec.ts`
- `docs/neon-deployment-guide.md`

## 파일별 책임

### `src/db/load-env.ts`

- `.env` 자동 로딩
- 이미 환경변수가 주입된 경우 이를 덮어쓰지 않음
- API 서버와 CLI 스크립트에서 공통 사용

### `src/db/database-url.ts`

- pooled/direct URL 해석
- 기본 URL과 direct fallback 규칙 정의
- TLS 관련 연결 설정 생성

예상 규칙:

- `DATABASE_URL`은 필수
- `DATABASE_URL_DIRECT`는 일반 앱 실행에는 선택이지만, `db:init` 같은 관리 작업에는 필수
- direct URL이 없으면 관리 작업은 명시적으로 실패한다

### `src/db/pg-client.ts`

- pooled `Pool` 싱글톤 생성
- pooled 경로용 helper 제공
- direct `Client` 생성 helper 제공
- transaction helper 유지

### `src/db/check-connection.ts`

- 기본 연결 점검은 pooled 연결 기준으로 수행
- 출력 메시지에서 Neon 연결 전제와 latency를 확인 가능하게 유지

### `src/db/init-schema.ts`

- direct 연결 사용
- schema init은 관리 작업이라는 의도를 명확히 표현

### `src/main.ts`

- 앱 부트 시 `.env` 자동 로딩

### `.env.example`

- Neon pooled URL 예시
- Neon direct URL 예시
- TLS 관련 설명 정리

### `README.md`

- Neon 생성 절차
- 권장 리전
- Free로 시작하는 기준과 Launch로 올리는 시점
- 로컬 수동 배치에서 상시 서버 cron으로 가는 운영 경로

### `docs/neon-deployment-guide.md`

- 공개 MVP 운영 기준 문서
- Neon 프로젝트 생성값
- 리전 선택 이유
- Launch 운영 권장안
- cron 배치 운영 방식

## 비용/플랜 가이드

### 시작 플랜

초기에는 `Free`로 시작한다.

이유:

- 현재 데이터 적재량에서는 기능 검증과 내부/초기 공개 테스트를 시작하기에 충분하다.
- Free는 프로젝트당 `100 CU-hours/month`, `0.5 GB storage`를 제공한다. [Pricing](https://neon.com/pricing)

### Launch 전환 시점

다음 중 하나가 발생하면 `Launch`로 전환한다.

- 외부 공개 운영이 시작되는 시점
- 저장량이 Free 한도에 근접하는 시점
- DB 사용 시간이 Free 사용량에 근접하는 시점
- 운영 DB를 always-on으로 유지해야 하는 시점

### 현재 데이터 기준 추산

현재 기준 전체 적재 규모:

- 제품 약 562건
- 오퍼 약 2,695건
- 1회 전체 적재 시 최소 약 3,257건

정규화 데이터 증가량 추정:

- 하루 1회 적재: 월 약 `0.295 GB`
- 하루 2회 적재: 월 약 `0.59 GB`
- 하루 4회 적재: 월 약 `1.18 GB`

따라서 Free 저장 한도 0.5GB는 스냅샷 누적 구조 기준으로 오래 유지되기 어렵다.

- 하루 1회 적재 시 약 7주 전후
- 하루 4회 적재 시 약 2주 전후

이 추산은 구조화된 데이터만 저장하는 기준이며, raw HTML, screenshot, raw payload는 포함하지 않는다.

## 배치 운영 방침

현재 구조는 `npm run batch:daily`를 외부 스케줄러가 호출하는 형태다.

MVP 단계 운영 권장 순서는 다음과 같다.

1. 로컬에서 수동 실행으로 데이터 품질 검증
2. 공개 직전, 상시 서버에 API와 배치를 함께 배포
3. cron으로 `npm run batch:daily -- --scheduled` 실행

이 방식이 현재 코드 구조와 가장 잘 맞고, 서버리스 스케줄링으로 바로 가는 것보다 단순하다.

## 비교 대안과 선택 근거

### 로컬 Postgres 계속 사용

- 장점: 가장 익숙하고 추가 학습이 적다.
- 단점: 공개 MVP 운영으로 이어질 때 다시 설정을 바꿔야 한다.

### Supabase

- 장점: 기능 폭이 넓고 잘 알려져 있다.
- 단점: 현재 프로젝트는 DB 자체가 핵심이고, 지금 단계에는 기능 폭보다 단순한 Postgres 운영이 중요하다.

### VPS/AWS 직접 구축

- 장점: 표면상 더 저렴할 수 있다.
- 단점: 백업, 장애 대응, 업그레이드, 운영 부담이 커진다.

### Neon 선택 근거

- 현재 프로젝트는 특정 프레임워크 친화성보다도 `Postgres + 저사용량 초기 비용 구조 + branching + 간단한 운영 전환 경로`가 더 중요하다.
- Neon은 이 네 가지를 균형 있게 만족한다.

## 테스트 전략

이번 작업은 설정 변경이므로 환경변수 해석 로직을 테스트로 먼저 고정한다.

우선 검증할 시나리오:

- `DATABASE_URL`이 없으면 명확한 에러를 반환한다.
- `DATABASE_URL`은 pooled URL을 기본값으로 사용한다.
- `DATABASE_URL_DIRECT`가 있으면 direct 경로가 해당 값을 사용한다.
- TLS 옵션이 Neon URL과 수동 SSL 설정을 함께 사용할 때 깨지지 않는다.

검증 명령:

- `npm test`
- `npm run build`

실제 연결 검증은 다음으로 마무리한다.

- `npm run db:check`

## 예외와 트레이드오프

- pooled/direct를 구분하면 설정은 명확해지지만 환경변수 개수는 늘어난다.
- 공개 MVP 기준에서는 이 비용보다 운영 안정성이 더 중요하므로 수용한다.
- `@nestjs/config` 같은 본격 설정 계층은 장기적으로 좋지만, 이번 범위에서는 과하다.
- 따라서 이번 변경은 기존 구조를 유지하면서 Neon 연결 규칙만 안정적으로 입히는 수준으로 제한한다.

## 구현 완료 기준

다음 조건이 충족되면 이번 작업을 완료로 본다.

- 로컬에서 `.env`만으로 앱과 배치가 실행된다.
- Neon pooled/direct URL 규칙이 코드와 문서에 반영된다.
- `db:init`은 direct 연결을 사용한다.
- README와 운영 문서에 리전/플랜/배치 운영 가이드가 정리된다.
- 환경변수 해석 로직에 대한 테스트가 추가된다.
