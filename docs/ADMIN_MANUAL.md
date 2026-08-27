# 어드민 앱 매뉴얼

> 최신 운영 기준은 슈퍼어드민 **시스템 매뉴얼** (`/admin/ops/system-manuals`, 2026-08-27)과 동일합니다.  
> 런타임 DB는 **MongoDB**입니다.

## 1. 개요

어드민 웹은 회원·경기·운영자·수익·몰·고객지원을 관리합니다. 루트 `/`는 `/admin/`으로 리다이렉트합니다.

---

## 2. 사용자 매뉴얼

### 2.1 인증

#### 로그인 (`/admin/login`)
- 관리자 계정으로 로그인
- 슈퍼어드민 / 일반어드민

#### 회원가입 (`/admin/signup`) · 승인 대기 (`/admin/waiting`)
- 신청 후 슈퍼어드민 승인

### 2.2 기본

| 화면 | 경로 |
|------|------|
| 앱 홈 설정 | `/admin/app-home-settings` |
| KBO 선수단 | `/admin/kbo-roster` |
| 오늘의 선발명단 | `/admin/today-lineups` |
| 앱 파일 등록/다운로드 | `/admin/ops/app-releases` |

### 2.3 슈퍼바이저 (슈퍼어드민)

| 화면 | 경로 |
|------|------|
| 관리자 등록/리스트 | `/admin/staff/register`, `/admin/staff/list` |
| 시스템 매뉴얼 | `/admin/ops/system-manuals` |
| 디비 백업 | `/admin/ops/db-backup` |
| 관리자·운영자 로그인 현황 | `/admin/ops/admin-login-status`, `/admin/ops/manager-login-status` |

### 2.4 경기 · 운영자 · 회원

| 화면 | 경로 |
|------|------|
| 경기 관리(달력) | `/admin/match-management` |
| 실시간 게임 모니터링 | `/admin/match-monitoring` |
| 운영자 등록/리스트 | `/admin/operators/register`, `/admin/operators/list` |
| 운영자 상태 | `/admin/monitoring` |
| 회원 리스트·랭킹·초대 | `/admin/members/*` |

- 운영자 리스트 **실황 ON/OFF** = 다음 스포츠 + 네이버 + 회원 게임 연동 (API-SPORTS 아님). 기본 1경기.
- 「예측 시작」은 `predictionEnabled`만. `matchStatus=ongoing`은 다음 실황 근거로만 올립니다.
- 스코어 PATCH → `controlMode=manual`. 수동을 끄면 auto.

### 2.5 수익 · 몰 · 고객지원

- 수익: `/admin/revenue/video` · `/admin/revenue/banner` · `/admin/revenue/video-ad-manage` · `/admin/revenue/waiting-screen`
- 몰: `/admin/mall-preview` · `/admin/mall-management` · `/admin/mall-orders` · `/admin/mall-sales` · `/admin/mall-inventory` · `/admin/mall-purchase`
- 지원: `/admin/notices`, `/admin/support`, `/admin/board`, `/admin/terms`

### 2.6 예측 운영 요약

회원 한 타석: 경기전(쿠어스) → 대기(시네마틱) → 선택(3D) → 결과대기(시네마틱) → 큰 글씨 2.2초 → 적중 시 주루(실사, 홈런은 1·2·3루 후 홈).

타이밍: 타석 참여 시작 5분 전 · 예측 창 8초 자동 중지 · 광고 50초 · 타자 안정화 2초 · 투수 6초.

자세한 표는 시스템 매뉴얼 페이지를 엽니다.

---

## 3. 테크니컬 매뉴얼

### 3.1 기술 스택

| 구분 | 기술 |
|------|------|
| 프레임워크 | React 18 + TypeScript |
| 빌드 도구 | Vite |
| 라우팅 | Wouter |
| 상태관리 | TanStack Query v5 |
| 스타일링 | Tailwind CSS + shadcn/ui |
| 서버 | Express + tsx, MongoDB, Redis |
| 차트 | Recharts |

### 3.2 파일 구조

```
client/src/
├── adminPages/          # 관리자 화면 (ops/system-manuals 포함)
├── AdminApp.tsx
└── lib/adminQueryClient.ts
server/
├── mongodb/models.ts    # 운영 DB
└── ops/systemManualsService.ts
shared/
├── systemManuals.ts
├── systemOpsHandbook.ts
└── predictionScreenFlow.ts
```

### 3.3 권한

| 권한 | 설명 |
|------|------|
| 슈퍼어드민 | 모든 기능 + 관리자 승인 + 시스템 매뉴얼 |
| 일반어드민 | 회원/경기/몰/콘텐츠 (슈퍼바이저 메뉴 제외) |

### 3.4 데이터베이스

운영은 MongoDB (`User`, `Match`, `Prediction`, `AdminUser`, `MallOrder` 등).  
PostgreSQL 가져오기는 구제품 일회성 이전용입니다.
