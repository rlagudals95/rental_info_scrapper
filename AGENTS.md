# AGENTS.md — Rental Info Scrpper Engineering Playbook

이 문서는 이 프로젝트에서 작업하는 모든 에이전트/개발자가 **일관된 엔터프라이즈 품질**을 유지하도록 강제하는 실행 기준입니다.

목표:
- NestJS 기반
- OOP/DDD 성향의 설계
- 테스트 가능성/변경 용이성/운영 안정성 우선
- "빠르게 대충"보다 "작게 나눠 정확하게"

---

## 0) 기본 원칙 (Non-Negotiable)

1. **동작하는 코드보다 유지보수 가능한 코드**
   - 3개월 뒤 내가 아닌 사람이 읽어도 이해 가능해야 한다.
2. **관심사 분리 (Separation of Concerns)**
   - Controller는 얇게, UseCase/Service는 명확하게, Infra는 격리한다.
3. **의존성 역전 (DIP)**
   - 비즈니스 로직은 DB/외부 API 구현 세부사항에 의존하지 않는다.
4. **명시적 계약 (Explicit Contracts)**
   - DTO, Interface, Return Type, 에러 규약을 명시한다.
5. **테스트 없는 로직 = 미완성 로직**
   - 핵심 도메인 계산 로직은 반드시 테스트한다.
6. **작은 PR/작은 커밋**
   - 원자적 변경 단위로 작업하고, 메시지는 의도를 담는다.

---

## 1) 아키텍처 가이드

기본적으로 **레이어드 + 헥사고날(Ports & Adapters) 절충** 구조를 따른다.

### 권장 모듈 구조

```txt
src/
  modules/
    comparison/
      application/        # UseCase, Application Service
      domain/             # Entity, VO, Domain Service, Domain Error
      infrastructure/     # Repository Impl, Query Adapter, External Client
      presentation/       # Controller, DTO, Presenter
      comparison.module.ts

    catalog/
    offer/
    crawler/

  common/
    application/
    domain/
    infrastructure/
    presentation/
```

### 레이어 책임

- **presentation (Controller/DTO)**
  - HTTP 입출력 변환, 검증, 응답 포맷
  - 비즈니스 규칙 금지
- **application (UseCase)**
  - 유스케이스 오케스트레이션
  - 트랜잭션 경계
  - 도메인 객체 호출
- **domain**
  - 핵심 규칙, 계산, 불변성
  - 프레임워크/Nest 의존 금지
- **infrastructure**
  - DB, 캐시, 외부 API, 메시지큐
  - domain/application interface 구현

---

## 2) OOP/DDD 설계 규칙

1. **Anemic Domain Model 지양**
   - 계산/검증 로직은 Entity/VO/DomainService에 둔다.
2. **Value Object 적극 사용**
   - Money, ContractTerm, SupportAmountRange, TransparencyScore 등
3. **불변성 우선**
   - 가능한 객체는 immutable하게 설계한다.
4. **도메인 예외 분리**
   - `DomainError`, `ApplicationError`, `InfrastructureError` 분리
5. **Repository는 domain 관점 인터페이스 먼저**
   - `OfferRepository` 인터페이스를 domain/application에 두고 구현은 infra에서.
6. **매직 값 금지**
   - enum/constant로 의미를 부여한다.

---

## 3) NestJS 코딩 규칙

1. **Controller는 얇게 유지**
   - Controller에서 계산/분기 로직 작성 금지
2. **UseCase 단위 클래스화**
   - `GetWaterPurifierComparisonUseCase` 같은 명시적 이름
3. **DI 토큰 명시**
   - interface 주입 시 symbol/token 사용
4. **Validation 파이프 필수**
   - class-validator + class-transformer 적용
5. **Global Exception Filter 표준화**
   - 에러 응답 형식 통일 (`code`, `message`, `details`, `traceId`)
6. **Config 분리**
   - `@nestjs/config` + schema validation (zod/joi)
7. **로깅 표준화**
   - 구조적 로깅(JSON) + requestId/traceId 포함

---

## 4) API 설계 규칙

1. **REST 일관성 유지**
   - 리소스 중심 URI, 명확한 query parameter
2. **버전 전략 명시**
   - `/v1/...` 또는 헤더 버저닝 중 하나 선택 후 고정
3. **정렬/필터/페이징 표준화**
   - `sort`, `page`, `pageSize`, `cursor` 규약 통일
4. **응답 계약 고정**
   - 성공/실패 envelope 스펙 문서화
5. **OpenAPI(Swagger) 최신화**
   - DTO 변경 시 문서 즉시 갱신

---

## 5) 데이터/트랜잭션 규칙

1. **마이그레이션 기반 스키마 변경만 허용**
   - 수동 DB 변경 금지
2. **트랜잭션 경계는 UseCase에서 관리**
3. **Snapshot 테이블 append-only 원칙 준수**
4. **시간 데이터는 UTC 저장, 표시 시 타임존 변환**
5. **nullable 남용 금지**
   - 의미 없는 null 허용을 줄이고 상태값으로 표현

---

## 6) 테스트 전략 (필수)

### 테스트 피라미드

- Unit Test (많이)
  - 도메인 계산/정렬/필터
- Integration Test (중간)
  - Repository + DB
- E2E Test (핵심 시나리오)
  - 비교 목록/상세 API

### 최소 기준

- 새 유스케이스 추가 시:
  - Unit test 필수
  - API endpoint가 생기면 e2e 1개 이상
- 버그 수정 시:
  - 재현 테스트 먼저 작성 후 수정

---

## 7) 코드 스타일/품질 게이트

1. **TypeScript strict 모드 유지**
2. **`any` 사용 금지 (예외 시 주석으로 사유 기재)**
3. **ESLint + Prettier + import 정렬 강제**
4. **함수 길이 30~40라인 권장**
5. **순환 의존성 금지**
6. **공개 메서드는 의도 중심 이름 사용**

권장 스크립트 예시:

```bash
npm run lint
npm run test
npm run test:e2e
npm run build
```

PR 전 위 4개 모두 통과해야 병합 가능.

---

## 8) 커밋/PR 규칙

### 커밋 메시지

Conventional Commits 권장:

- `feat: add water purifier comparison sorting by effectiveCost12m`
- `fix: correct support amount range normalization`
- `refactor: split offer matching service into use cases`
- `test: add unit tests for effective cost calculator`

### PR 체크리스트

- [ ] 변경 목적/배경이 설명되었는가
- [ ] 테스트가 추가/수정되었는가
- [ ] API/스키마 문서가 갱신되었는가
- [ ] 브레이킹 체인지 여부가 명시되었는가
- [ ] 롤백 방법이 명시되었는가

---

## 9) 성능/운영 규칙

1. **N+1 쿼리 금지**
2. **비싼 정렬/집계는 인덱스 설계와 함께 변경**
3. **외부 호출은 timeout/retry/circuit breaker 고려**
4. **관측성(Observability) 기본 탑재**
   - health check, structured log, metrics, trace
5. **장애 대응 가능성 우선**
   - 실패 시 degraded mode 또는 명확한 에러 반환

---

## 10) 보안/컴플라이언스

1. **비밀정보 커밋 금지**
   - `.env`, API key, 토큰
2. **입력값 검증/출력값 이스케이프 기본 적용**
3. **민감정보 로그 마스킹**
4. **SQL Injection/XSS/SSRF 기본 방어**
5. **의존성 취약점 주기 점검**

---

## 11) 이 프로젝트 도메인 특화 규칙

1. **가격은 Money VO로 계산**
   - 부동소수점 직접 계산 금지
2. **지원금 공개 상태(`exact/range/hidden/quote_required`)를 강타입으로 관리**
3. **공식가 / 채널오퍼가 / 확정견적가를 절대 혼합하지 말 것**
4. **체감가 계산식은 버전 관리**
   - `EffectiveCostPolicyV1` 처럼 정책 버전 명시
5. **비교 결과는 "근거 필드"를 함께 반환**
   - 사용자 신뢰성과 디버깅 가능성 확보

---

## 12) 작업 프로토콜 (에이전트용)

작업 시작 시:
1. 요구사항을 유스케이스 단위로 쪼갠다.
2. 변경 범위를 모듈/레이어별로 명시한다.
3. 테스트 전략을 먼저 적는다.

구현 중:
1. 작은 단위로 구현 + 즉시 테스트
2. 경계(도메인/인프라) 침범 여부 수시 점검
3. 로그/에러 메시지를 운영 관점에서 검토

작업 종료 시:
1. lint/test/build 통과 확인
2. 변경 요약 + 트레이드오프 + 후속 TODO 기록
3. 원자적 커밋

---

## 13) Do / Don’t

### Do
- 의도를 드러내는 이름
- 작은 클래스, 작은 메서드
- 명시적 타입/계약
- 테스트로 회귀 방지

### Don’t
- Controller 비대화
- Service God Object
- 무분별한 유틸 함수 남발
- "일단 동작" 후 방치

---

## 14) 최종 목표

이 프로젝트의 코드는 아래를 만족해야 한다:

- 신규 개발자가 1시간 안에 구조를 이해한다.
- 핵심 도메인 계산 로직이 테스트로 보호된다.
- 기능 추가 시 기존 코드 수정량이 작다.
- 운영 중 장애 원인 추적이 쉽다.

**품질은 속도의 적이 아니라, 장기 속도의 기반이다.**
