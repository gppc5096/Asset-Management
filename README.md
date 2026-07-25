# Asset Management

개인 자산·배당금 관리 대시보드. 국내/해외 주식·ETF 보유 현황과 계좌별(일반/특별/비과세) 배당금 수령 내역을 추적하고, 세후 실수령액과 원천징수 세액을 자동 계산합니다.

## 주요 기능

- **Google 로그인** (Firebase Auth) — 계정별 데이터 완전 분리
- **대시보드** — 총 자산 현황(KRW 환산), 연도별/월별 배당 수령액 추이, 과세분배금·과세금액 현황, 종목별 분배금·주가 콤보차트
- **계좌별 분배금 관리** (특별계좌 / 일반계좌 / 비과세계좌) — 조회기간 필터, 검색, 종목 추가/수정/삭제, 내보내기/가져오기(JSON), 클라우드 백업/복원, 월별 추이·현주가 추이·비중 차트
- **자산관리(보유 종목 원장)** — 매수/매도 거래 기록, 국가 → 증권사 → 종목명/계좌번호 계단식 자동완성, 계좌번호 선택 시 계좌유형 자동 매칭, KRW/USD 현금 잔고 관리
- **모바일 반응형** — 데스크톱 상단 탭 / 모바일 하단 탭바
- **PWA** — 홈 화면 설치, 오프라인 캐싱(서비스 워커)

## 기술 스택

- [Next.js 16](https://nextjs.org) (App Router, Turbopack, Static Export)
- TypeScript, Tailwind CSS v4, [shadcn/ui](https://ui.shadcn.com)
- [Firebase](https://firebase.google.com) — Authentication(Google), Firestore
- [Recharts](https://recharts.org)
- Firebase Hosting 배포

## 세금 계산 로직

원천징수세율 15.4% 고정 (실데이터 검증 완료):

```
taxAmount = round(taxedDistribution × 0.154)   // 일반계좌 · 특별계좌
taxAmount = 0                                    // 비과세계좌 (항상 비과세)
total     = distributionReceived − taxAmount
```

## 시작하기

### 1. 환경 변수 설정

`.env.example`을 `.env.local`로 복사하고 Firebase 프로젝트 설정값을 채웁니다.

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
```

### 2. Firestore 보안 규칙

`firestore.rules`가 사용자 본인의 데이터(`users/{uid}/**`)만 읽고 쓸 수 있도록 제한합니다. 배포:

```bash
firebase deploy --only firestore:rules
```

### 3. 개발 서버 실행

```bash
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000) 접속.

### 4. 빌드 & 배포

정적 export 후 Firebase Hosting에 배포합니다.

```bash
npm run build
firebase deploy --only hosting
```

## 데이터 구조 (Firestore)

```
users/{uid}/backups/
  ├─ asset-config   # 보유 종목(holdings), 현금 잔고, 적용환율
  ├─ general        # 일반계좌 분배금 기록
  ├─ special        # 특별계좌 분배금 기록
  └─ tax-free       # 비과세계좌 분배금 기록
```
