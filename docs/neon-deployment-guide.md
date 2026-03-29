# Neon Deployment Guide

기준일: 2026-03-28

## 한 줄 결론

이 프로젝트는 `Neon + pooled runtime connection + direct admin connection` 구성을 기본값으로 사용한다.

## 권장 생성값

- Provider: `AWS`
- Region: `Asia Pacific (Singapore)`
- Postgres version: `17`
- 개발 시작 플랜: `Free`
- 공개 MVP 운영 플랜: `Launch`

## 연결 규칙

- `DATABASE_URL`
  - Neon pooled URL
  - API 서버, 로컬 배치, 상시 서버 배치에서 사용
- `DATABASE_URL_DIRECT`
  - Neon direct URL
  - `npm run db:init` 같은 관리 작업에서 사용

## 운영 권장안

- 개발/내부 검증: `Free + autosuspend 사용`
- 공개 MVP: `Launch + 운영 DB autosuspend 해제`
- 배치: 상시 서버에서 cron으로 `npm run batch:daily -- --scheduled`

## Launch 전환 시점

다음 중 하나가 발생하면 `Launch` 전환을 권장한다.

- 외부 공개 운영 시작
- 저장량이 `0.5GB`에 가까워짐
- 운영 DB를 항상 켜둘 필요가 생김
- Free 사용량 한도에 가까워짐

## 현재 데이터 기준 추산

- 1회 전체 적재: 약 `3,257건`
- 하루 1회 적재: 월 약 `0.295GB`
- 하루 4회 적재: 월 약 `1.18GB`

따라서 스냅샷이 계속 누적되면 Free 저장 한도는 오래 유지되기 어렵다.

- 하루 1회 적재: 약 `7주`
- 하루 4회 적재: 약 `2주`

## 로컬에서 시작하는 방식

1. Neon 프로젝트 생성
2. `.env.example`을 복사해 `.env` 생성
3. pooled URL을 `DATABASE_URL`에 입력
4. direct URL을 `DATABASE_URL_DIRECT`에 입력
5. `npm run db:init`
6. `npm run db:check`
7. `npm run start:dev`

## 공개 MVP 운영 순서

1. 로컬에서 수동 배치로 데이터 품질 검증
2. 상시 서버에 API 배포
3. 같은 서버 또는 별도 worker에서 cron 배치 실행
4. 운영 DB는 always-on으로 전환
