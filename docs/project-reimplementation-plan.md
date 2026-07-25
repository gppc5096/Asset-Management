# bluebirdasset 프로젝트 재구현 Plan

> 로컬에서 삭제된 자산관리 웹앱(`bluebirdasset.web.app`)을 소스코드 없이 재구현하기 위한 계획.
> 백엔드(Firebase 프로젝트·Firestore 데이터)는 본인 소유로 이미 확보했고, 프론트엔드는 배포된 빌드 산출물만 남아있는 상태에서 시작한다.

## 1. 현재 확보된 것 / 확보 불가능한 것

### 확보됨 (`firebase-backup/`)

| 항목                      | 파일                                 | 비고                                               |
| ----------------------- | ---------------------------------- | ------------------------------------------------ |
| Firebase Web SDK config | `firebase-config.txt`              | apiKey, authDomain, projectId 등                  |
| Firestore 보안 규칙         | `firestore.rules`                  | `users/{uid}/{document=**}` 소유자 전용               |
| Firestore 인덱스           | `firestore.indexes.json`           | 커스텀 인덱스 없음 (전부 단일 필드 쿼리로 추정)                     |
| **Firestore 실데이터**      | `firestore-data.json`              | 아래 3장 참고 — 가장 중요한 자산                             |
| 배포 사이트 정적 산출물           | `site-mirror/`                     | Next.js(Turbopack) 빌드 결과물 — HTML, JS 청크, CSS, 폰트 |
| 라우트/컬렉션 힌트              | `site-mirror/_extracted-hints.txt` | 번들 문자열에서 추출                                      |

### 확보 불가능 (재작성 필요)

- **원본 소스코드(.tsx/.ts)** — `site-mirror`의 JS는 minify+번들된 컴파일 산출물이라 컴포넌트 구조·변수명·주석은 복원 불가. UI 마크업과 API 호출 패턴은 역추적 가능한 수준.
- **정확한 비즈니스 로직 구현 세부사항** (세금 계산 공식의 정확한 반올림 규칙 등) — 데이터의 결과값으로 역산은 가능하나 100% 동일하다고 보장 못 함.
- **Cloud Functions 소스** — 애초에 사용 안 했으므로 해당 없음.
- **Storage 파일** — 버킷 자체가 생성된 적 없어 해당 없음.

## 2. 확인된 스택

- **배포**: Firebase Hosting (`bluebirdasset.web.app`), 정적 export로 추정 (Cloud Functions 미사용)
- **프레임워크**: Next.js (App Router, Turbopack 빌드 — `turbopack-*.js` 청크 확인됨)
- **백엔드**: Firebase 클라이언트 SDK 직접 호출 (Firestore) — 별도 API 서버 없음
- **인증**: Firebase Auth (규칙상 `request.auth.uid` 기반 — 로그인 방식은 이메일/비번 or 소셜, 확인 필요)
- **스타일**: 번들된 CSS 1개 파일 (`081c0776cb7ff85b.css`, 51KB) — Tailwind 여부는 `site-mirror` 클래스명 분석으로 검증 필요

## 3. Firestore 데이터 모델 (실데이터 기반 역추적)

```
users/{uid}                          ← ghost document (필드 없음, 서브컬렉션만 존재)
  └─ backups/
       ├─ asset-config              ← 보유자산 원장
       │    ├─ holdings: Holding[]
       │    ├─ cash: { krw, usd, updatedAt }
       │    ├─ exchangeRate: { rate, source: "auto", fetchedAt }
       │    └─ updatedAt
       ├─ general                   ← 일반계좌 배당/분배금 기록
       │    ├─ records: DistributionRecord[]
       │    └─ updatedAt
       ├─ special                   ← 특별계좌 배당/분배금 기록
       │    ├─ records: DistributionRecord[]
       │    └─ updatedAt
       └─ tax-free                  ← 비과세계좌 배당/분배금 기록
            ├─ records: DistributionRecord[]
            └─ updatedAt
```

`asset-config`/`general`/`special`/`tax-free` 네이밍은 `site-mirror`에서 추출된 라우트 힌트(`/asset-config`, `/general`, `/special`, `/tax-free`)와 정확히 일치 — **이 4개가 앱의 4개 주요 화면(탭)** 이라는 강한 근거.

### Holding (asset-config.holdings[])

매수/매도 거래 1건 = 1 항목. 계좌 구분(`accountType`: 일반계좌/특별계좌/비과세저축계좌/ISA/연금저축계좌)별로 같은 배열 안에 섞여 있음 → 화면에서는 accountType 기준으로 필터링해 4개 탭에 나눠 보여주는 구조로 추정.

| 필드                         | 타입                  | 설명                                         |
| -------------------------- | ------------------- | ------------------------------------------ |
| `id`                       | string(uuid)        | 클라이언트 생성                                   |
| `ticker`                   | string              | 종목명 (한국은 "티커-종목명" 혼합 표기, 미국은 "TICKER-종목명") |
| `date`                     | string (YYYY-MM-DD) | 거래일                                        |
| `broker`                   | string              | 증권사 (키움/한투/NH 등)                           |
| `accountNumber`            | string              | 계좌번호                                       |
| `accountType`              | string enum         | 일반계좌 / 특별계좌 / 비과세저축계좌 / ISA / 연금저축계좌       |
| `assetType`                | string enum         | 개별주식 / ETF주식                               |
| `country`                  | "KOR" \| "USA"      |                                            |
| `tradeType`                | "매수" \| "매도"(추정)    |                                            |
| `quantity`                 | number              |                                            |
| `unitPrice`                | number              |                                            |
| `buyAmount` / `sellAmount` | number              |                                            |
| `appliedRate`              | number              | 매수 시점 적용환율 (원화 계좌는 0)                      |
| `distributionCycle`        | string enum         | 없음 / 월초 / 월중 / 월말 / 분기                     |

### DistributionRecord (general/special/tax-free.records[])

배당/분배금 지급 1회 = 1 항목 (종목별 시계열).

| 필드                                   | 설명                                              |
| ------------------------------------ | ----------------------------------------------- |
| `ticker`                             | 종목명                                             |
| `date`                               | 지급일                                             |
| `quantity`                           | 지급 시점 보유수량                                      |
| `price`                              | 지급 시점 기준가                                       |
| `distribution`                       | 주당 분배금                                          |
| `distributionReceived`               | 세전 분배금 총액 (quantity × distribution)             |
| `taxBase`                            | 주당 과세대상 분배금 (`taxedDistribution = taxBase × quantity`로 확정) |
| `taxAmount`                          | 원천징수세액 (`round(taxedDistribution × 0.154)`, 비과세계좌는 항상 0) |
| `taxedDistribution`                  | 과세대상 분배금 총액 (`taxBase × quantity`)              |
| `total`                              | 세후 실수령액 (`distributionReceived - taxAmount`)    |
| `held`                               | 현재도 보유 중인지                                      |
| `priceChange` / `distributionChange` | 전회 대비 변동 (현재 데이터에선 전부 0 — 계산 로직 또는 미구현 필드일 가능성) |

**세금 공식 검증 완료 (Phase 2, 실데이터 51건 전수 대조)**:
- 일반계좌/특별계좌: `taxAmount = round(taxedDistribution × 0.154)` — 25건 전부 오차 0
- 비과세계좌: `taxAmount`는 `taxedDistribution` 값과 무관하게 항상 `0` (26건 전부) — 계좌 성격상 원천징수 자체가 없음
- `taxBase`는 세액 계산에 쓰이지 않는 별도 필드(과세 대상 수량 등으로 추정, 화면 표시용)

## 4. 재구현 4단계

### Phase 1 — 스캐폴딩 & 연결

- `new-next` 스킬로 Next.js(App Router, TS, Tailwind) 프로젝트 생성
- `firebase-backup/firebase-config.txt`의 config로 Firebase 클라이언트 SDK 연결
- `firestore.rules`를 그대로 `firestore.rules`에 배치, `firebase deploy --only firestore:rules`로 재배포(선택)
- Firebase Auth **Google 소셜 로그인** 구현 (확정 — 이메일/비번 폼 불필요)
- 공통 레이아웃: 상단 네비 5탭(대시보드/특별계좌/일반계좌/비과세계좌/자산관리) + 로그인 이메일/로그아웃
- 최초 진입 온보딩 모달("My Asset Portfolio", 1일 1회 노출) 뼈대

### Phase 2 — 데이터 레이어

- 위 스키마대로 TypeScript 타입 정의 (`Holding`, `DistributionRecord`, `AssetConfig` 등)
- Firestore read/write 훅 작성 (`useAssetConfig`, `useDistributionRecords(category)`)
- `firestore-data.json`을 emulator 또는 실제 프로젝트로 재현/검증용 시드로 활용
- 세금 계산 유틸: `taxAmount = round(taxedDistribution × 0.154)` (일반/특별), 비과세계좌는 항상 `0` — 실데이터 51건 전수 대조로 검증 완료

### Phase 3 — 화면 재구현 (6절 UI 구조 기반, 구현 순서)

1. **계좌별 분배금 현황 공용 컴포넌트** (6.4절) — 특별계좌/일반계좌/비과세계좌 3탭이 동일 컴포넌트 재사용 (props: category). 조회기간 필터, 요약 카드 3개, 액션 툴바(내보내기/가져오기/클라우드 백업·복원/초기화/자산 추가), 데이터 테이블, 하단 차트 4종
2. **자산관리 페이지** (6.5절) — holdings 원장 테이블 + 계좌유형/증권사 필터 + 현금 인라인 수정 + 하단 차트 4종
3. **대시보드 페이지** (6.3절) — 위 두 화면의 데이터를 집계하는 뷰라서 마지막에 구현 (연도별/월별 배당 집계표, 과세 현황표, 종목별 콤보차트)
4. **반응형 네비게이션** (6.6절) — 상단 5탭(데스크톱) / 하단 고정 탭바(모바일) 브레이크포인트 분기
- `site-mirror/index.html`과 CSS, `docs/screenshot/` 스크린샷을 함께 참고해 레이아웃/톤 재현

### Phase 4 — PWA & 아이콘 시스템 (7절·8절 참고)

- Favicon/App Icon SVG 제작 및 각 사이즈별 파일 생성 → Next.js App Router 아이콘 컨벤션에 배치
- `manifest.json`(Web App Manifest) 작성 + PWA 아이콘(192/512/maskable) 등록
- 서비스 워커 등록 (오프라인 캐싱 전략 포함) — `next-pwa` 또는 Next.js 네이티브 방식 중 결정
- iOS `apple-touch-icon`, `theme-color`, `viewport-fit=cover` 등 메타 태그 설정

### Phase 5 — 검증

- 실 데이터 렌더링 후 합계·세금 계산이 `docs/screenshot/` 스크린샷 수치와 일치하는지 대조 (예: 특별계좌 분배금 합계 ₩10,659,197 등)
- Firestore 규칙 재배포 후 본인 계정(Google 로그인)으로 로그인 → 읽기/쓰기 정상 동작 확인
- 모바일 뷰포트(Chrome DevTools/실기기)에서 하단 탭바 동작 및 PWA 설치(Add to Home Screen) 확인
- Lighthouse PWA 체크리스트 통과 확인
- Firebase Hosting에 재배포

## 5. 확인된 사항 (사용자 답변 반영, 2026-07-25)

| 질문 | 확정 내용 | 비고 |
|---|---|---|
| 로그인 방식 | **Google 소셜 로그인** | Firebase Auth GoogleAuthProvider만 구현하면 됨. 이메일/비번 폼 불필요 |
| 환율 자동조회 소스 | 미확인 (기억 안 남) — `exchangeRate.source: "auto"` 값만 확인됨 | Phase 1에서 무료 환율 API(예: exchangerate-api, 한국수출입은행) 중 하나로 새로 결정해 구현. 기존과 100% 동일할 필요는 없음 |
| 세금 계산 공식 | **원천징수세율 15.4% 고정** | 실데이터 검증 결과 `taxAmount = round(taxedDistribution × 0.154)` (일반/특별), 비과세계좌는 항상 `0` — 3.3절 참고 |
| 화면 레이아웃 | **스크린샷 6장 확보** (`docs/screenshot/`) → 6장 UI 구조 아래 6절에 정리 완료 | 아래 참고 |

## 6. 화면 UI 구조 (스크린샷 기반 확정)

스크린샷 6장으로 전체 화면 구성이 거의 100% 확인됨. `site-mirror`에서 추출된 라우트 힌트와도 완전히 일치.

### 6.1 상단 네비게이션 (공통 레이아웃)
- 좌측 로고: `Asset Management` (아이콘 + 텍스트)
- 탭 5개: **대시보드 / 특별계좌 / 일반계좌 / 비과세계좌 / 자산관리**
  - "특별계좌·일반계좌·비과세계좌"는 Firestore의 `special`/`general`/`tax-free` 서브컬렉션과 1:1 대응
  - "자산관리"는 `asset-config`(holdings 원장)에 대응
  - "대시보드"는 별도 Firestore 문서가 아니라 위 4개 데이터를 **집계해서 보여주는 계산된 뷰**
- 우측: 로그인 이메일 표시 + 로그아웃 버튼

### 6.2 최초 진입 온보딩 모달 ("My Asset Portfolio")
- 보라색 그라디언트 헤더, 상단 트렌드 아이콘 + 타이틀 + 부제 "오늘의 자산 현황 요약"
- 중앙: TOTAL ESTIMATED ASSETS(총 자산 KRW 환산) + 적용환율(USD) 배지
- 하단 2분할 카드: USD Assets / KRW Assets (KRW는 "현금 + 국내주식" 합산 표기)
- 좌하단 "오늘 하루 보지 않기" 체크박스, 우하단 "닫기" 버튼
- → **로컬스토리지/쿠키 기반 1일 1회 노출 로직** 필요

### 6.3 대시보드 페이지
- 상단 보라 그라디언트 바: 총 자산 현황 (KRW 환산) + 적용환율 + 마지막 업데이트 시각
- 4개 스탯 카드: 해외주식(USD) / 국내주식(KRW) / USD 현금 / KRW 현금
- **연도별 배당 수령액**: 연도 토글(2026/2025) + 전체 수령액(세후) + 계좌별(특별/일반/비과세) 진행바(금액+비율)
- **월별 배당 수령액 추이 표**: 1~12월 × (특별계좌/일반계좌/비과세계좌/월 합계/누적액), 맨 아래 합계 행
- **과세분배금 및 과세금액 현황 표**: 월별 × 계좌별(과세분배금/과세금액) + 합계열
- **주가등락 및 분배금 등락 현황**: 종목별 콤보차트(막대=배당, 선=주가) 2개 이상, 종목 선택 가능한 구조로 추정

### 6.4 계좌별 분배금 현황 (특별계좌/일반계좌/비과세계좌 — 공통 템플릿)
3개 탭이 완전히 동일한 레이아웃을 공유하고 데이터만 다름 → **하나의 재사용 컴포넌트**로 구현.
- 타이틀 + 부제, 조회기간 설정(시작월/종료월 드롭다운, 예: 2026-04 → 2026-07)
- 3개 요약 카드: 주식수량 합계 / 평균 주식 단가(가중평균) / 분배금 합계
- 액션 버튼 툴바: 내보내기 / 가져오기 / 클라우드 백업 / 클라우드 복원 / 초기화 / **자산 추가**
- 검색창 (자산 검색: 종목명)
- 데이터 테이블: 거래일, 종목명, 주식수량, 현주가, 주가등락(색상), 분배금, 분배금총액, 과세표준, 과세분배액, 과세금액, 합계, 상태(보유/매도), 수정/삭제 아이콘
  - 매도 처리된 종목은 취소선 + "매도" 배지로 구분 표시 (일반계좌 스크린샷에서 확인)
- 하단 차트 4종: 월별 분배금 수령액 추이(종목별 스택 막대), 종목별 현주가 추이(라인), 종목별 분배금 비중(가로 스택 막대), 월별 순수령액 vs 과세금액(막대)

### 6.5 자산관리 페이지 (holdings 원장, `asset-config` 대응)
- 조회기간 설정 + 3개 요약 카드: 총 자산(추정) / USD 자산(연필 수정 아이콘) / KRW 자산(연필 수정 아이콘)
  - USD/KRW 자산 카드에 수정 아이콘 → **현금(cash.krw/usd)을 직접 인라인 수정 가능**한 UI
- 필터: 계좌유형(전체/일반계좌/특별계좌/비과세저축계좌/ISA/연금저축계좌) 드롭다운, 증권사 드롭다운
- 검색창 + 동일한 액션 툴바(내보내기/가져오기/클라우드 백업·복원/초기화/자산 추가)
- 데이터 테이블: 주식구분(국내/해외), 국가, 거래일, 증권사, 종목명, 계좌번호, 계좌유형, 거래(매수/매도), 배당주기, 수량, 매수금액
- 하단 차트 4종: 통화별 자산 구성(도넛), 통화별 종목 보유수량(리스트+아이콘), 계좌유형별 투자 비중(도넛), 종목별 보유 비중(가로 스택 막대)

### 6.6 모바일 반응형 — 하단 탭 메뉴 (`mobile-bottom-tab-menu.png` 기반)

모바일 화면에서는 데스크톱의 상단 5탭 네비게이션이 **하단 고정 탭바**로 전환됨. 같은 데이터/라우트를 가리키지만 라벨과 아이콘이 다름.

| 탭 | 데스크톱 라벨 | 모바일 라벨 | 아이콘(모바일) |
|---|---|---|---|
| 1 | 대시보드 | 현황 | 그리드(2x2) |
| 2 | 특별계좌 | 특별 | 반짝임(sparkle) |
| 3 | 일반계좌 | 일반 | 지갑 |
| 4 | 비과세계좌 | 비과세 | 방패+체크 |
| 5 | 자산관리 | 자산 | 톱니바퀴 |

- 활성 탭: 아이콘+라벨 보라색(`#6D28D9` 계열) 강조, 비활성은 회색
- 상단 헤더는 모바일에서도 유지 (로고 + 로그인 이메일/로그아웃은 좁은 화면에서 축약 가능성 있음 — 스크린샷엔 이메일 그대로 노출)
- iOS 홈 인디케이터 영역 침범 방지 위해 `padding-bottom: env(safe-area-inset-bottom)` 필요
- 구현 방식: Tailwind 반응형 브레이크포인트로 **동일 레이아웃 컴포넌트 내에서 `md:` 이상은 상단 탭, 이하는 하단 고정 탭바**로 분기 (별도 모바일 전용 라우트/페이지 불필요 — 콘텐츠 영역은 공유)
- 하단 탭바는 `position: fixed; bottom: 0` + 콘텐츠 영역에 `padding-bottom`으로 겹침 방지

### 6.7 구현 우선순위 재조정 근거
- "계좌별 분배금 현황" 3개 화면은 **완전히 동일한 컴포넌트를 재사용**하는 게 명백하므로, 공용 컴포넌트 1개 + props(category)로 구현
- 대시보드는 다른 4개 화면의 데이터를 조합만 하면 되므로 **가장 마지막에 구현**하는 게 합리적 (의존성 역전 방지)
- "클라우드 백업/복원" 버튼 존재 확인 → Firestore 서브컬렉션 이름이 `backups`인 이유가 설명됨 (사용자가 수동으로 스냅샷 백업/복원하던 기능으로 추정). 재구현 시 필수 기능은 아니지만 데이터 안전성 차원에서 포함 권장.

## 7. PWA (프로그레시브 웹 앱) 구현 계획

기존 사이트가 PWA였다는 증거는 없음(모바일 화면도 반응형 웹뷰로 보임) — **이번 재구현에서 신규로 추가하는 기능**.

### 7.1 목표
- 홈 화면에 추가(Add to Home Screen) 가능
- standalone 모드 실행 (브라우저 주소창 없이 앱처럼)
- 기본적인 오프라인 지원 (완전 오프라인 자산관리는 불필요 — 정적 자산 캐싱 + "오프라인입니다" 안내 수준으로 충분, Firestore 실시간 데이터는 온라인 필요)

### 7.2 구성 요소
| 파일 | 역할 |
|---|---|
| `app/manifest.ts` (Next.js App Router 네이티브 방식) | `name`, `short_name`, `theme_color`, `background_color`, `display: "standalone"`, `icons[]`, `start_url` 정의 |
| Service Worker | 정적 자산(JS/CSS/폰트) 캐싱, 네비게이션 fallback |
| `app/layout.tsx` 메타데이터 | `viewport`, `themeColor`, `appleWebApp` 설정 |

### 7.3 구현 방식 결정
- Next.js 15+ App Router는 `app/manifest.ts`로 매니페스트를 코드 기반 생성 가능 → 별도 `public/manifest.json` 불필요
- 서비스 워커는 `next-pwa`(써드파티) 대신, 필요 최소 기능만 있으면 되므로 **직접 작성한 경량 서비스 워커**(정적 자산 cache-first, API/Firestore 요청은 network-only)를 우선 검토 — 라이브러리 의존성 최소화
- `theme_color`는 8절에서 정할 아이콘 색상(보라/블루 그라디언트 중 대표색 1개)과 통일

### 7.4 아이콘 요구사항 (PWA ↔ 8절 연동)
- `icons`: 192×192, 512×512 (any + maskable 각각) 최소 2세트 필요 → 8절에서 생성

## 8. Favicon & App Icon 구현 계획 (`favicon.png` 기반)

첨부된 `favicon.png`는 기존 사이트 곳곳에서 이미 재사용되던 아이콘(온보딩 모달 트렌드 아이콘, 데스크톱 상단 로고 아이콘, 모바일 하단 탭 "현황" 아이콘과 동일 모티프)과 일치하는 **막대그래프(bar-chart) 심볼**, 파랑→보라 그라디언트.

### 8.1 SVG 원본 제작
- `favicon.png`를 참고해 3개 막대(오름차순 높이)로 구성된 벡터 SVG 신규 제작 (래스터 이미지를 직접 트레이싱하지 않고, 동일한 형태·색상·비율로 벡터 재설계)
- 그라디언트: 좌하단 진한 블루(`#4F46E5` 계열) → 우상단 퍼플(`#7C3AED` 계열), 기존 온보딩 모달 헤더 그라디언트와 톤 통일
- 파일 위치: `app/icon.svg` (Next.js App Router 아이콘 컨벤션 — 자동으로 favicon으로 서빙됨)

### 8.2 파생 아이콘 파일 생성 (SVG → 각 사이즈 래스터화)
| 파일 | 사이즈 | 용도 |
|---|---|---|
| `app/icon.svg` | vector | 모던 브라우저 favicon (자동 인식) |
| `app/favicon.ico` | 16/32/48 멀티사이즈 | 구형 브라우저 fallback |
| `app/apple-icon.png` | 180×180 | iOS 홈 화면 추가 아이콘 |
| `public/icons/icon-192.png` | 192×192 | PWA manifest `icons` (purpose: any) |
| `public/icons/icon-512.png` | 512×512 | PWA manifest `icons` (purpose: any) |
| `public/icons/icon-maskable-512.png` | 512×512, 여백 포함(safe zone) | PWA manifest `icons` (purpose: maskable) — 안드로이드 어댑티브 아이콘 |

### 8.3 적용
- Next.js App Router 컨벤션 파일(`app/icon.svg`, `app/apple-icon.png`, `app/favicon.ico`)은 `<head>`에 자동 삽입 — 수동 `<link>` 태그 불필요
- `app/manifest.ts`의 `icons` 배열에 `public/icons/*` 경로 등록 (7.4절과 연결)
- 로고로도 재사용: 상단 네비 로고 아이콘, 온보딩 모달 아이콘, 모바일 탭바 "현황" 아이콘을 전부 이 SVG 한 벌로 통일 (색상만 컨텍스트에 맞게 currentColor 등으로 조정 가능하게 설계)

## 9. Non-goals (이번 재구현 범위 밖)

- 원본과 픽셀 단위로 동일한 UI (불가능 — 원본 CSS 클래스는 확보했으나 컴포넌트 구조는 유실)
- Cloud Functions, Storage 등 원래도 안 쓰던 기능 추가
- 배당 세금 계산의 국세청 공식 검증 (사용자가 직접 쓰던 로직 재현이 목표, 세무 정확성 보장 아님)

---

*작성 근거: `firebase-backup/` 내 실제 Firestore export 및 배포 사이트 미러 데이터. 2026-07-25 기준.*
