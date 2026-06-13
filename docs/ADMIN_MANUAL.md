# 어드민 앱 매뉴얼

## 1. 개요

어드민 앱은 전체 서비스를 관리하는 관리자용 웹 애플리케이션입니다. 회원 관리, 경기 관리, 수익 관리 등 모든 운영 기능을 제공합니다.

---

## 2. 사용자 매뉴얼

### 2.1 인증

#### 로그인 (`/admin/login`)
- 관리자 계정으로 로그인
- 슈퍼 관리자 / 일반 관리자 권한 구분

#### 회원가입 (`/admin/signup`)
- 관리자 계정 신청
- 슈퍼 관리자 승인 필요

#### 승인 대기 (`/admin/waiting`)
- 승인 대기 상태 안내

### 2.2 회원 관리

#### 회원 목록 (`/admin/members/list`)
- 전체 회원 조회
- 회원 검색 (이름, 아이디, 전화번호)
- 회원 승인/거절
- 회원 상세 정보 확인
- 포인트 수동 지급/차감

#### 기부 랭킹 (`/admin/members/donation-rankings`)
- 기부 포인트 순위 조회

#### 승리 랭킹 (`/admin/members/victory-ranking`)
- 예측 승리 횟수 순위

#### 포인트 랭킹 (`/admin/members/points-ranking`)
- 보유 포인트 순위

#### 초대 관리 (`/admin/members/invite`)
- 초대 코드 사용 현황
- 추천인 보상 내역

### 2.3 관리자 관리

#### 스태프 목록 (`/admin/staff`)
- 관리자 계정 목록
- 관리자 승인/거절
- 권한 관리 (슈퍼 관리자만)

#### 매니저 목록 (`/admin/managers`)
- 매니저 계정 목록
- 매니저 승인/거절
- 매니저 정보 관리

#### 경기 배정 (`/admin/match-assignment`)
- 매니저에게 경기 배정
- 배정 현황 조회

#### 운영자 모니터링 (`/admin/monitoring`)
- 운영자 활동 로그
- 시스템 상태 모니터링

### 2.4 경기 관리

#### 경기 관리 (`/admin/match-management`)
- **구장 탭**: 경기 구장 등록/삭제 (최신순 정렬)
- **경기 탭**: 경기 일정 등록
  - 경기 날짜, 구장, 시작/종료 시간 설정
  - 복수 경기 동시 등록 가능

#### 실시간 경기 모니터링 (`/admin/match-monitoring/:dateKey`)
- 진행 중인 경기 실시간 현황
- 참여자 수, 베팅 현황
- 라운드별 결과 확인

### 2.5 수익 관리

#### 배너 수익 (`/admin/revenue/banner`)
- 배너 광고 관리
- 배너 등록/수정/삭제
- 노출 순서 설정

#### 동영상 관리 (`/admin/revenue/video`)
- 동영상 콘텐츠 관리
- 동영상 업로드/삭제

#### 동영상 광고 관리 (`/admin/revenue/video-ad-manage`)
- 동영상 광고 설정
- 광고 스케줄 관리

#### 대기 화면 관리 (`/admin/revenue/waiting-screen`)
- 예측 대기 시 표시되는 화면 관리
- 이미지/동영상 설정

### 2.6 콘텐츠 관리

#### 공지사항 (`/admin/notices`)
- 공지사항 작성/수정/삭제
- 공지 노출 설정

#### 약관 관리 (`/admin/terms`)
- 서비스 이용약관 관리
- 개인정보처리방침 관리

#### 고객 지원 (`/admin/support`)
- 1:1 문의 답변
- 문의 상태 관리

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
| 차트 | Recharts |

### 3.2 파일 구조

```
client/src/
├── adminPages/
│   ├── auth/
│   │   ├── login.tsx           # 관리자 로그인
│   │   ├── signup.tsx          # 관리자 회원가입
│   │   └── waiting.tsx         # 승인 대기
│   ├── admins/
│   │   ├── StaffList.tsx       # 스태프 목록
│   │   ├── ManagerList.tsx     # 매니저 목록
│   │   ├── ManagerMatchAssignment.tsx # 경기 배정
│   │   ├── MatchManagement.tsx # 경기 관리
│   │   ├── RealtimeGameMonitoring.tsx # 실시간 모니터링
│   │   ├── OperatorMonitoring.tsx # 운영자 모니터링
│   │   └── Monitoring.tsx      # 시스템 모니터링
│   ├── members/
│   │   ├── MemberList.tsx      # 회원 목록
│   │   ├── DonationRankings.tsx # 기부 랭킹
│   │   ├── VictoryRanking.tsx  # 승리 랭킹
│   │   ├── PointsRanking.tsx   # 포인트 랭킹
│   │   ├── InviteManagement.tsx # 초대 관리
│   │   └── PointHistory.tsx    # 포인트 내역
│   ├── revenue/
│   │   ├── BannerRevenue.tsx   # 배너 수익
│   │   ├── AdvertisementManagement.tsx # 광고 관리
│   │   └── WaitingScreenManagement.tsx # 대기 화면
│   ├── components/
│   │   └── AdminSidebar.tsx    # 사이드바
│   ├── CustomerSupport.tsx     # 고객 지원
│   ├── Notices.tsx             # 공지사항
│   ├── TermsManagement.tsx     # 약관 관리
│   ├── Videos.tsx              # 동영상 관리
│   └── adminLayout.tsx         # 레이아웃
├── AdminApp.tsx                # 어드민 앱 진입점
└── lib/
    └── adminQueryClient.ts     # 관리자용 API 클라이언트
```

### 3.3 권한 체계

| 권한 | 설명 | 접근 가능 기능 |
|------|------|---------------|
| 슈퍼 관리자 | 최고 권한 | 모든 기능 + 관리자 승인 |
| 일반 관리자 | 운영 권한 | 회원/경기/콘텐츠 관리 |

### 3.4 미들웨어

- `adminAuthMiddleware`: 일반 관리자 이상 접근 허용
- `superAdminAuthMiddleware`: 슈퍼 관리자만 접근 허용

### 3.5 API 엔드포인트

#### 인증
| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| POST | `/api/admin/login` | 관리자 로그인 |
| POST | `/api/admin/register` | 관리자 등록 |
| POST | `/api/admin/refresh` | 토큰 갱신 |

#### 회원 관리
| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET | `/api/admin/members` | 회원 목록 |
| PUT | `/api/admin/members/:id/approve` | 회원 승인 |
| PUT | `/api/admin/members/:id/reject` | 회원 거절 |
| POST | `/api/admin/members/:id/points` | 포인트 지급 |

#### 경기 관리
| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET | `/api/admin/stadiums` | 구장 목록 (최신순) |
| POST | `/api/admin/stadiums` | 구장 등록 |
| DELETE | `/api/admin/stadiums/:id` | 구장 삭제 |
| GET | `/api/admin/matches` | 경기 목록 |
| POST | `/api/admin/matches` | 경기 등록 |
| DELETE | `/api/admin/matches/:id` | 경기 삭제 |

#### 매니저 관리
| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET | `/api/admin/managers` | 매니저 목록 |
| PUT | `/api/admin/managers/:id/approve` | 매니저 승인 |
| POST | `/api/admin/match-assignment` | 경기 배정 |

#### 콘텐츠 관리
| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET | `/api/admin/notices` | 공지사항 목록 |
| POST | `/api/admin/notices` | 공지 작성 |
| PUT | `/api/admin/notices/:id` | 공지 수정 |
| DELETE | `/api/admin/notices/:id` | 공지 삭제 |

### 3.6 데이터베이스 테이블

| 테이블 | 설명 |
|--------|------|
| `admin_users` | 관리자 계정 |
| `manager_users` | 매니저 계정 |
| `users` | 일반 회원 |
| `stadiums` | 경기 구장 |
| `matches` | 경기 정보 |
| `match_assignments` | 경기 배정 |
| `predictions` | 예측 기록 |
| `notices` | 공지사항 |
| `inquiries` | 1:1 문의 |
| `banners` | 배너 광고 |

### 3.7 세션 관리

- Redis 기반 세션 스토어
- 관리자별 별도 세션 네임스페이스
- 중복 로그인 시 기존 세션 종료
- 세션 만료 시 WebSocket 연결 해제
