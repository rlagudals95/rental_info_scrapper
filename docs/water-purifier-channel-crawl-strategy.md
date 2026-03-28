# 정수기 렌탈 채널 수집 전략

기준일: 2026-03-27

대상 채널:

- 아정당: `https://www.ajd.co.kr/electronics/overview/2010-4020/ranking`
- 렌트리: `https://rentre.kr/water-purifier`
- 미소: `https://miso.kr/booking/rental/water_purifier`

## 한 줄 결론

세 사이트를 하나의 방식으로 긁으면 실패한다.

- 아정당은 `SSR HTML 파싱` 중심
- 미소는 `__NEXT_DATA__ + 내부 API` 중심
- 렌트리는 `공개 API` 중심

따라서 수집도 `상품 마스터`, `공개 오퍼`, `상담형 견적 근거`를 분리해야 한다.

## Playwright 기준 기술 관찰

### 아정당

- Playwright 렌더링 결과, 카드 정보가 초기 DOM에 이미 포함된다.
- `curl` 기준 raw HTML에서도 모델코드와 월요금, 카드할인시 월요금이 확인된다.
- 초기 네트워크 요청에서는 상품 목록 API가 보이지 않았고, `popup`, `cart/rental/4020` 같은 부가 요청만 확인됐다.

판단:

- 아정당은 `Playwright 필수`가 아니라 `HTTP fetch + HTML parser` 우선 전략이 맞다.
- 단, 랭킹 페이지는 추천 카드 중심이므로 전수 수집은 sibling route나 추가 라우트 탐색이 필요하다.

### 미소

- raw HTML에 `__NEXT_DATA__`가 포함된다.
- `__NEXT_DATA__` 안에는 `rentalRecommendProducts`, `filterOptions`가 있다.
- 추천 상품 데이터 내부 `stocks[].values`에 아래 필드가 들어 있다.
  - `monthly_fee`
  - `card_discount`
  - `rental_period`
  - `maintenance_type`
  - `payback.cash`
- 별도 네트워크 요청으로 `https://www.getmiso.com//lambdaro/public/directory-v1-get-goods` POST가 호출된다.

판단:

- 미소는 DOM 파싱보다 `__NEXT_DATA__` 파싱이 더 안정적이다.
- 필터 조합 확장은 `directory-v1-get-goods`를 직접 호출하는 방식이 가장 좋다.
- UI에 `상담시 별도 혜택 안내`가 떠도 내부 데이터에는 `payback.cash`가 존재할 수 있으므로, 화면 문구만 믿고 `quote_required`로 저장하면 데이터 손실이 생긴다.

### 렌트리

- raw HTML에는 핵심 상품 데이터가 거의 없다.
- `__NEXT_DATA__`도 없다.
- 실제 데이터는 `api.doublecheck.kr` 계열 공개 API에서 로딩된다.
- 확인된 핵심 엔드포인트:
  - `/api/v3/product/listBySearch`
  - `/api/product/search/filter`
  - `/api/v2/product/new/list`
  - `/api/product/recommend/category`
  - `/api/product/searchCategory/ByProdCatg`
- 상세 페이지에는 리스트보다 더 풍부한 정보가 있다.
  - 모델코드
  - 제휴카드 조건
  - 관리방식
  - 최근 견적 비교
  - 후기 기반 지원금 예시

판단:

- 렌트리는 Playwright로 구조를 파악한 뒤, 실제 수집은 `공개 API 직접 호출`로 전환하는 것이 가장 효율적이다.
- 상세 페이지는 2차 수집에서 사용한다.

## 사이트별 관찰 결과

### 1. 아정당

현재 정수기 랭킹 페이지에서 바로 보이는 정보:

- 랭킹 순위
- 브랜드명
- 상품명
- 모델코드
- 월 렌탈료
- 카드할인시 월 요금
- 종합점수
- 세부 점수: 정수성능, 위생관리, 편의기능, 렌탈료
- 리뷰 수
- 기능 태그: 냉수, 온수, 정수, 얼음, 살균수 등
- 주요 스펙
  - 제품유형
  - 정수타입
  - 필터종류
  - 필터개수
  - 편의기능 개수
  - 살균부위
  - 직수관 재질 또는 저수조 재질
  - 분리세척 여부
  - 정량출수 여부
  - 온수온도조절 여부
- 추천 포인트 문구

관찰한 특성:

- 페이지 상단에는 `현금 지원금 최대 30만원` 문구가 있으나 카드별 지원금은 랭킹 카드에 직접 노출되지 않는다.
- 실제 카드에는 월요금과 카드가, 스펙, 점수는 잘 보이지만 `채널별 확정 지원금`은 거의 없다.
- 정적 추출 기준으로 전체 `175건` 중 일부 카드만 노출되며, 나머지는 추가 로딩 또는 클라이언트 렌더링 가능성이 높다.
- 같은 카테고리의 sibling route로 보이는 `.../total` 경로에서는 총 상품 수와 가격 위주의 카드 노출이 확인되어, `ranking`보다 전수 수집에 더 적합할 가능성이 높다.
- raw HTML에서 모델코드와 가격이 바로 확인되므로, 1차는 브라우저 없이 수집 가능하다.

판단:

- 아정당 랭킹 페이지는 `가격 비교용 오퍼 목록`이라기보다 `상품 추천/카탈로그 강화 소스`에 가깝다.
- 1차 수집 대상은 `상품 마스터 + 대표 월요금 + 카드가 + 스펙 + 점수`다.
- 지원금은 이 페이지만으로는 정확 수집이 어렵기 때문에 별도 상세/상담/후기 경로가 필요하다.
- 구현 방식은 `HTTP fetch + Cheerio`가 1순위고, 누락 시에만 Playwright fallback을 둔다.

### 2. 미소

현재 리스트 페이지에서 바로 보이는 정보:

- 추천 순위 영역 `TOP N`
- 프로모션 배지: `NEW`, `3월 인기`, `반값할인`, `직수최저가` 등
- 브랜드명 + 상품명
- 제품 기능 태그: 냉수, 온수, 정수, 얼음
- 기본 월요금
- 계약기간: 예) `(84개월)`, `(72개월)`, `(60개월)`
- 제휴카드가
- 혜택 노출 방식
  - `상담시 별도 혜택 안내`
  - `예상 혜택 30,000원`
  - `예상 혜택 210,000원`
  - `예상 혜택 300,000원`
- 필터
  - 형태: 데스크형, 스탠드형, 언더싱크
  - 기능: 정수, 냉정, 냉온정, 얼음냉온정 등
- 정렬 기준
  - 인기순
  - 낮은 렌탈료
  - 높은 사은품

상세 페이지에서 추가로 확인 가능한 정보:

- 브랜드
- 정확한 상품명
- 모델코드
- 정상가
- 계약기간
- 제휴카드가
- 혜택 문구
- 상세 URL의 모델코드 기반 식별자

관찰한 특성:

- 미소는 리스트만으로도 `오퍼 수준 가격 정보`가 꽤 잘 드러난다.
- 모델코드는 상세 URL 또는 상세 페이지에서 안정적으로 얻을 수 있다.
- 혜택은 `정확 금액` 또는 `상담 필요`로 나뉘며, 범위형보다는 `상담시 별도 혜택 안내`가 더 자주 보인다.
- 일부 상세 페이지는 `예상 혜택 100,000원`, `220,000원`, `300,000원`처럼 고정 금액을 명시한다.
- `__NEXT_DATA__`와 `directory-v1-get-goods` 응답에는 UI보다 더 자세한 stock/payback 정보가 포함된다.

판단:

- 미소는 현재 세 사이트 중 `가장 먼저 수집 자동화를 붙이기 좋은 채널`이다.
- 리스트 수집만으로도 비교 API MVP에 넣을 수 있는 필드가 충분하다.
- 구현은 `__NEXT_DATA__` 우선, 부족한 경우 `directory-v1-get-goods` 직접 호출이 최적이다.

### 3. 렌트리

일반 카테고리 페이지 `https://rentre.kr/water-purifier`는 정적 추출 기준으로 카드 정보가 거의 보이지 않았다.

하지만 브랜드별 정수기 페이지에서는 아래 정보가 확인된다:

- 브랜드별 정수기 목록
- 주문 수: 예) `주문 1,000+`
- 배지: `BEST`, `NEW`
- 프로모션 문구: `25년 출시!`, `타사보상 혜택`
- 상품명
- 예상 요금
- 반값할인/할인 퍼센트: 예) `50%`
- 프로모션 월요금
- 프로모션 종료 후 정상 월요금: 예) `6개월 후 32,900원`, `12개월 후 28,900원`
- 예상 혜택
  - `11~34만원`
  - `32~39만원`
  - `?`
- 평점: 예) `4.9(251)`

추가로 후기/견적 페이지에서 확인 가능한 정보:

- 실제 견적서의 월요금
- 반값할인 적용 여부
- 정상 전환 월요금
- 판매자 혜택 금액
- 렌트리 혜택 금액
- 매니저/판매자 정보

관찰한 특성:

- 렌트리는 `카테고리 페이지`보다 `브랜드 페이지`와 `견적 후기 페이지`가 더 풍부하다.
- 공개 리스트만으로도 `예상 요금`과 `예상 혜택 범위`를 얻을 수 있다.
- 추가 후기 페이지를 보면 같은 상품이라도 판매자별 혜택이 다르다.
- 즉, 렌트리는 구조상 `상품 1개 = 다수 견적`이 자연스러운 채널이다.
- 브랜드 페이지 URL 패턴이 비교적 명확하다: `/brand/{brandSlug}/water-purifier`
- 견적 후기 페이지는 `/review/product/proposal/{productId}` 패턴으로 보이며 실계약 월요금과 혜택 근거 확보에 유용하다.
- 일반 카테고리 페이지도 렌더링 후에는 상품 카드가 보이지만, 실데이터는 `api.doublecheck.kr`에서 내려온다.

판단:

- 렌트리는 브라우저 자동화 없이는 누락 위험이 높다.
- 1차는 브랜드 페이지에서 `대표 오퍼 범위`를 수집하고,
- 2차는 후기/견적 페이지에서 `실계약 근거 데이터`를 별도 쌓는 전략이 맞다.
- 실제 구현은 Playwright로 파악한 API를 직접 호출하는 방향이 가장 효율적이다.

## 공통으로 가져와야 할 필드

### 상품 마스터

- `brandName`
- `productName`
- `modelCode`
- `category = water-purifier`
- `detailUrl`
- `imageUrl`
- `featureTags`
- `shape/installType`

### 공개 가격

- `publicMonthlyFee`
- `cardAppliedMonthlyFee`
- `contractTermMonths`
- `promoDiscountPercent`
- `promoMonthlyFee`
- `promoDurationMonths`
- `postPromoMonthlyFee`

### 혜택 공개 상태

- `supportPricingModel`
- `supportAmount`
- `supportAmountMin`
- `supportAmountMax`
- `benefitDisclosureText`

### 신뢰/랭킹 보조 정보

- `listingRank`
- `listingSortType`
- `reviewCount`
- `rating`
- `orderCount`
- `badges`
- `recommendationCopy`

## 현재 도메인 모델로의 매핑

### 바로 매핑 가능한 필드

- `publicMonthlyFee`
- `nonCardMonthlyFee`
- `cardAppliedMonthlyFee`
- `supportPricingModel`
- `supportAmount`
- `supportAmountMin`
- `supportAmountMax`
- `offerName`
- `publicOfferUrl`
- `metadata`

### metadata에 먼저 넣어야 하는 필드

현재 스키마에는 아래 필드를 위한 정규 컬럼이 없다.

- 프로모션 할인율
- 프로모션 적용 개월 수
- 프로모션 종료 후 월요금
- 랭킹 점수
- 리뷰 평점
- 주문 수
- 배지 목록
- 추천 포인트
- 상세 스펙 블록

따라서 1차 구현에서는 `channel_offers.metadata` 또는 `products.specifications`에 저장하고,
수집 안정화 후 정규화 여부를 다시 판단하는 것이 좋다.

## 지원금 공개 상태 매핑 규칙

### 아정당

- 랭킹 카드에 지원금 수치가 없으면 기본적으로 `hidden`
- 페이지/상세에서 `상담`, `문의`, `별도 안내`가 확인되면 `quote_required`
- 금액이 직접 나오면 `fixed_public`
- 범위가 나오면 `range_public`

### 미소

- UI에 `상담시 별도 혜택 안내`가 보이더라도 내부 `payback.cash`가 있으면 `fixed_public`
- 내부 payback이 없고 상세/리스트 문구가 상담 유도면 `quote_required`
- `예상 혜택 300,000원` -> `fixed_public`
- 향후 `예상 혜택 10~20만원` 형태가 나오면 `range_public`

### 렌트리

- `예상 혜택 11~34만원` -> `range_public`
- `예상 혜택 ?` -> `hidden`
- 후기/견적 페이지에서 판매자 혜택 금액이 공개되면 `fixed_public`

## 수집 단계 전략

### 1단계: 리스트 기반 발견 수집

목표:

- 어떤 상품이 존재하는지 발견
- 대표 월요금/카드가/혜택 공개 상태를 빠르게 확보

사이트별 방식:

- 아정당: `total` 우선, `ranking` 보조 수집
- 미소: `__NEXT_DATA__` 기본 수집 + `directory-v1-get-goods` 필터 확장
- 렌트리: `api.doublecheck.kr/api/v3/product/listBySearch` 중심 수집

결과:

- `products`
- `sales_channels`
- `channel_offers`
- `offer_benefits` 일부

### 2단계: 상세 페이지 정규화

목표:

- 모델코드 보강
- 상세 스펙/이미지/정확한 상품명 정규화

사이트별 방식:

- 미소: 상세 페이지에서 모델코드와 상품명 확정
- 렌트리: 상품 상세 또는 브랜드 페이지 링크 기준으로 상세 URL 확보
- 아정당: 상세 URL이 노출되면 상품 마스터 보강용으로만 사용

### 3단계: 상담형 혜택 근거 수집

목표:

- 공개 리스트에서 보이지 않는 지원금 구조를 근거와 함께 쌓기

대상:

- 렌트리 견적 후기 페이지
- 아정당 후기/커뮤니티/혜택 페이지
- 미소의 별도 상담/이벤트/혜택 페이지가 있다면 추가

결과:

- `quote_response` 성격의 데이터
- 판매자별 혜택 변동 폭
- 플랫폼 추가 혜택 여부

## 구현 우선순위

### P1. 미소부터 구현

이유:

- raw HTML만으로 `__NEXT_DATA__`를 얻을 수 있다.
- stock 수준 월요금/계약기간/관리방식/payback을 확보할 수 있다.
- 상세 페이지 URL에 모델코드가 포함돼 식별 안정성이 높다.

### P2. 렌트리 브랜드 페이지 수집

이유:

- 이미 공개 API가 확인됐다.
- `프로모션 요금 -> 정상 전환 요금`, 리뷰수, 평점, 배지, 혜택 범위를 한 번에 받을 수 있다.
- 상세/후기 페이지로 2차 근거 수집을 붙이기 좋다.

### P3. 아정당은 상품 마스터/랭킹 강화용으로 우선 수집

이유:

- 스펙과 점수가 매우 좋다.
- 하지만 현재 리스트만으로는 지원금 비교 채널로 쓰기 어렵다.
- 따라서 처음부터 `혜택 소스`로 보기보다 `상품 카탈로그 보강 소스`로 두는 편이 안전하다.

## 크롤링 기술 전략

### 기본 원칙

- 정적 HTML 우선
- 누락 시 브라우저 자동화
- 데이터는 append-only snapshot으로 저장

### 권장 방식

- 아정당: HTTP fetch + HTML parser 우선, 누락 시 브라우저 fallback
- 미소: HTTP fetch + `__NEXT_DATA__` 파싱 우선, 이후 내부 API 확장
- 렌트리: Playwright로 구조 확인 후 JSON API 직접 호출

### 브라우저 자동화가 필요한 신호

- 정적 HTML에서 카드 수가 비정상적으로 적음
- `Loading...` 이후 데이터가 없음
- 동일 URL에서 사용자 환경에 따라 카드 수가 달라짐
- 후기/견적 페이지에서 비동기 로딩이 발생함

## 저장 전략

### Product

- 브랜드/상품명/모델코드 중심으로 중복 제거
- 모델코드가 없으면 `brand + normalizedName` 임시 키 사용

### RentalPlan

- 계약기간이 보이면 우선 plan 분리
- 관리방식이 노출되지 않으면 `metadata` 보관 후 미분류

### ChannelOffer

- 사이트별 공개 리스트 카드를 1차 오퍼로 저장
- 렌트리 후기 기반 추가 견적은 별도 `quote` 성격으로 분리 저장

### Snapshot

- 같은 URL이라도 월요금/혜택이 바뀌면 새 snapshot append
- `firstSeenAt`, `lastSeenAt` 갱신

## 운영 리스크

- 아정당은 전체 카드가 정적 HTML에 다 보이지 않을 수 있다.
- 미소는 필터/정렬에 따라 노출 리스트가 달라질 수 있다.
- 렌트리는 일반 카테고리 페이지보다 브랜드 페이지, 후기 페이지가 더 유효한 소스일 수 있다.
- 렌트리 혜택은 판매자별로 달라 고정가처럼 취급하면 왜곡될 수 있다.

## 바로 다음 액션

1. 미소 리스트 크롤러를 먼저 만든다.
2. 미소는 `__NEXT_DATA__`에서 stock 단위 offer를 생성하도록 설계한다.
3. 렌트리는 `api.doublecheck.kr` 호출 기반 수집기로 시작한다.
4. 아정당은 가격 비교 소스가 아니라 상품 스펙 보강 소스로 먼저 연결한다.
5. 추후 `promoDurationMonths`, `postPromoMonthlyFee`, `rating`, `orderCount` 정규화 필요성을 검토한다.
