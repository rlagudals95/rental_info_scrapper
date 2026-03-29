# Rental Info Scrapper MVP

NestJS 기반의 정수기 렌탈 공개 비교 MVP입니다.

## 포함 범위

- 정수기 공개 비교 API
- 고정 정찰형/범위형/상담 필요 지원금 모델
- 공개 오퍼 기준 12개월 체감가 계산
- 수동 검수 상태가 `approved`인 오퍼만 노출
- PostgreSQL용 MVP 스키마

## 빠른 시작

```bash
npm install
cp .env.example .env
npm run db:init
npm run db:check
npm run start:dev
```

서버 기본 주소:

- `http://localhost:3000/comparison/water-purifiers`
- `http://localhost:3000/comparison/water-purifiers/product-coway-icon-ice`

## DB 설정 (Neon)

이 프로젝트는 `Neon Postgres`를 기본 DB로 사용합니다.

권장 생성값:

- Provider: `AWS`
- Region: `Asia Pacific (Singapore)`
- Postgres version: `17`
- Plan: 개발은 `Free`, 외부 공개 운영은 `Launch`

환경 변수 설정:

```bash
cp .env.example .env
```

- `DATABASE_URL`: Neon pooled URL
- `DATABASE_URL_DIRECT`: Neon direct URL

초기 스키마 반영:

```bash
npm run db:init
```

연결 점검:

```bash
npm run db:check
```

운영 기준:

- 개발/내부 검증은 `Free + autosuspend`
- 공개 MVP는 `Launch + 운영 DB always-on`

자세한 운영 가이드는 [docs/neon-deployment-guide.md](/Users/hyeongmin/Desktop/workspace/rental_info_scrpper/docs/neon-deployment-guide.md) 를 참고하세요.

## 지원금 모델

- `fixed_public`: 공개된 고정 정찰 지원금
- `range_public`: 공개된 범위형 지원금
- `quote_required`: 상담 시 확인
- `hidden`: 존재를 암시하지만 수치 미공개

## 주요 쿼리 파라미터

- `brand`
- `managementType`
- `contractTermMonths`
- `hasIce`
- `maxNonCardMonthlyFee`
- `supportPricingModel`
- `sort`

예시:

```bash
curl "http://localhost:3000/comparison/water-purifiers?managementType=visit&sort=effectiveCost12mMax"
```

## 배치 실행

일일 크롤링 배치는 외부 스케줄러가 `npm run batch:daily`를 호출하는 구조입니다.

필수 환경 변수:

```bash
export DATABASE_URL=postgresql://...-pooler.../neondb?sslmode=require
export DATABASE_URL_DIRECT=postgresql://.../neondb?sslmode=require
```

초기 스키마 반영:

```bash
npm run db:init
```

수동 배치 실행:

```bash
npm run batch:daily
```

크론 예시:

```bash
0 5 * * * cd /Users/hyeongmin/Desktop/workspace/rental_info_scrpper && /usr/bin/env npm run batch:daily -- --scheduled >> /var/log/rental-batch.log 2>&1
```

배치는 다음을 수행합니다.

- 채널별 크롤링 실행
- `batch_runs`, `crawl_runs` 실행 이력 기록
- 현재값 테이블과 스냅샷 테이블 갱신
- `latest-products.csv`, `latest-offers.csv` 갱신
- 실패/드리프트 발생 시 timestamped CSV archive 보존
