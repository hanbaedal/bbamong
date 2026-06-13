# PPADUN9 (빠던9) 소스 코드 분석 보고서

**프로젝트 경로:** `c:\PPADUN9\web`  
**작성일:** 2026년 6월 12일

---

## 1. 프로젝트 개요

이 프로젝트는 **야구 경기 실시간 예측·포인트·커뮤니티 플랫폼**인 PPADUN9(빠던9)입니다. 웹과 모바일(Android/iOS)을 함께 지원하며, **일반 사용자 / 관리자 / 매니저** 세 가지 앱이 하나의 코드베이스에서 동작하는 풀스택 모노레포 구조입니다.

### 1.1 핵심 가치

- **실시간 라운드 예측** — WebSocket 기반 동기화, 매니저가 현장에서 결과 입력
- **포인트·기부·랭킹** — 예측 성공 시 풀 분배, 기부, 승리/포인트 랭킹
- **3역할 분리** — 사용자 / 어드민 / 매니저가 각각 독립 UI·인증·세션 정책
- **모바일 네이티브** — Capacitor로 iOS/Android 앱, OAuth 딥링크, AdMob
- **운영 자동화** — 비활성 로그아웃, 경기 자동 종료, 정지 회원 정리 배치

---

## 2. 전체 디렉터리 구조

```
web/
├── client/              # React 프론트엔드 (User / Admin / Manager)
├── server/              # Express 백엔드 API + WebSocket
├── shared/              # Drizzle ORM 스키마 (프론트·백 공유)
├── assets/              # 이미지·SVG 등 정적 리소스
├── android-manager/     # 매니저 앱 Android 네이티브 셸
├── ios-manager-standalone/  # 매니저 iOS
├── capacitor.config.ts      # 사용자 앱 Capacitor 설정
└── capacitor.config.manager.ts  # 매니저 앱 설정
```

### 2.1 빌드·실행 명령

| 명령 | 역할 |
|------|------|
| `npm run dev` | Vite(프론트) + Express(백) 개발 서버 |
| `npm run build` | Vite 빌드 + esbuild로 서버 번들 |
| `npm run start` | 프로덕션 서버 실행 |
| `npm run db:push` | Drizzle로 DB 스키마 반영 |

---

## 3. 3개 앱 구조 (단일 진입점 분기)

`client/src/main.tsx`에서 URL 경로에 따라 앱을 분기합니다.

| 앱 | 경로 | 대상 | 주요 기능 |
|----|------|------|-----------|
| **UserApp** | `/login`, `/home`, `/prediction` 등 | 일반 회원 | 예측, 출석, 게시판, 포인트, 설정 |
| **AdminApp** | `/`, `/admin/*` | 슈퍼/일반 어드민 | 회원·경기·광고·모니터링 관리 |
| **ManagerApp** | `/manager/*` | 현장 매니저 | 경기 결과 입력, 실시간 운영 |

각 앱은 **별도 QueryClient, 토큰 관리, 에셋 프리로더**를 사용하여 역할별로 격리되어 있습니다.

---

## 4. 사용자 앱 (UserApp)

### 4.1 인증

- 로그인/회원가입, 비밀번호 찾기
- 소셜 로그인: Kakao, Google, Apple
- 게스트 로그인 (프로필, 고객센터, 게시글 작성 등 제한)

### 4.2 주요 화면

| 경로 | 기능 |
|------|------|
| `/home` | 홈 (기본 로그인 후 랜딩) |
| `/prediction` | 실시간 경기 예측 (WebSocket) |
| `/attendance` | 출석 체크 |
| `/board`, `/create-post`, `/post-detail` | 커뮤니티 게시판 |
| `/point`, `/point-history` | 포인트 관리 |
| `/setting/*` | 프로필, 초대, 기부 내역, FAQ, 공지, 전자책 등 |

### 4.3 모바일 특화

- Capacitor 기반 네이티브 앱 (`com.bbanden.nine`, 앱명 "빠던9")
- Android 뒤로가기: `/home`, `/login`에서만 앱 최소화
- AdMob 광고 (`useAdMob.ts`)
- Safe area, 375px 모바일 퍼스트 UI

---

## 5. 관리자 앱 (AdminApp)

루트(`/`)가 어드민 로그인으로 연결됩니다.

### 메뉴 구성 (AdminSidebar)

- **회원 관리** — 회원 리스트, 사회공헌참여기록 관리
- **운영자 관리** — 직원 리스트(슈퍼어드민), 운영자 리스트, 경기 할당, 상태 모니터링
- **수익 관리** — 동영상 광고 수익 현황
- **경기 관리** — 경기 생성/관리
- **공지사항, 고객 지원 센터, 약관 관리**

어드민은 **승인 대기 → 승인** 흐름이 있으며, 로그인 시 **선점 방식**(이미 로그인 중이면 409)으로 중복 로그인을 방지합니다.

---

## 6. 매니저 앱 (ManagerApp)

- 로그인/회원가입/승인 대기
- 홈: 배정된 경기 목록
- `matchDetail`: 라운드별 결과 입력·예측 시작/종료 제어
- Android/iOS 별도 빌드
- Error Boundary로 크래시 시 로그인 화면 복귀

---

## 7. 백엔드 아키텍처

### 7.1 API 라우트

- `/api/users`, `/api/points`, `/api/posts` ... → 일반 사용자 API
- `/api/admin/*` → 관리자 API
- `/api/manager/*` → 매니저 API
- `/api/live-match/*` → 실시간 예측 API

### 7.2 인증 미들웨어

| 파일 | 역할 |
|------|------|
| `userAuth.ts` | 일반 사용자 JWT |
| `adminAuth.ts` | 어드민 (역할·승인 상태 검증) |
| `managerAuth.ts` | 매니저 |
| `multiRoleAuth.ts` | 복수 역할 |

### 7.3 세션·인증 정책

- JWT + Refresh Token Rotation
- 토큰: httpOnly, secure, sameSite=strict 쿠키
- 세션 저장소: Redis
- 일반 사용자: 새 기기 로그인 시 기존 세션 강제 종료
- 어드민/매니저: 첫 로그인 우선 (409 차단)
- WS 종료 코드 4005 시 자동 재연결

### 7.4 실시간 경기 시스템 (`server/liveMatch/`)

| 모듈 | 역할 |
|------|------|
| `wsManager.ts` | WebSocket 연결·인증·브로드캐스트 |
| `broadcastManager.ts` | 이벤트 전파 |
| `predictionRoutes.ts` | 예측 제출 API |
| `matchControlRoutes.ts` | 라운드 시작/종료/결과 |
| `predictionStorage.ts` | DB 연동 |

**WebSocket 이벤트:** `prediction_started`, `prediction_ended`, `round_result`, `round_next`, `stats_update`, `ad_started`, `ad_stopped`, `waiting_screen_update`, `match_end`

### 7.5 배치 작업

| 파일 | 역할 |
|------|------|
| `inactiveLogoutBatch.ts` | 비활성 사용자 자동 로그아웃 |
| `matchAutoCloseBatch.ts` | 지난 경기 자동 완료 |
| `suspendedUserCleanupBatch.ts` | 정지 7일 경과 회원 영구 삭제 |

---

## 8. 데이터베이스 스키마 (`shared/schema.ts`)

| 테이블 | 설명 |
|--------|------|
| `users` | 회원 (소셜/게스트, 초대코드, 포인트) |
| `matches` | 경기 (구장, 일시, 상태, 현재 라운드) |
| `predictions` | 사용자별 라운드 예측 |
| `round_statistics` | 라운드별 통계 |
| `point_transactions` | 포인트 내역 |
| `admin_users` | 어드민/매니저 계정 |
| `advertisements`, `waiting_screens` | 광고·대기 화면 |

경기 상태: `scheduled` → `ongoing` → `completed` / `cancelled`

---

## 9. 기술 스택

### 프론트엔드

| 영역 | 기술 |
|------|------|
| UI | shadcn/ui, Tailwind CSS |
| 라우팅 | Wouter |
| 서버 상태 | TanStack Query |
| 폼 | React Hook Form + Zod |

### 백엔드

| 영역 | 기술 |
|------|------|
| 런타임 | Node.js + Express + TypeScript |
| ORM | Drizzle ORM |
| DB | PostgreSQL (Neon) |
| 세션 | Redis |
| 실시간 | WebSocket (ws) |

### 인프라

- Replit 환경, Neon DB, Redis
- 프로덕션: `https://ppadun9.com`
- Capacitor 모바일 앱

---

*보고서 끝*
