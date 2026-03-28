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
npm run start:dev
```

서버 기본 주소:

- `http://localhost:3000/comparison/water-purifiers`
- `http://localhost:3000/comparison/water-purifiers/product-coway-icon-ice`

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
