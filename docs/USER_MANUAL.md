# 유저 앱 매뉴얼

## 1. 개요

유저 앱은 실시간 야구 경기 예측 게임을 즐길 수 있는 모바일 최적화 애플리케이션입니다.

---

## 2. 사용자 매뉴얼

### 2.1 인증 (Authentication)

#### 로그인 (`/`)
- 아이디와 비밀번호로 로그인
- 소셜 로그인 지원: 카카오, 구글, 애플
- 자동 로그인 기능 (Refresh Token 기반)

#### 회원가입 (`/signup`)
- 필수 정보: 이름, 아이디, 비밀번호, 전화번호
- 추천인 코드 입력 시 +1000 보너스 포인트 지급
- 서비스 이용약관 및 개인정보처리방침 동의 필수

#### 비밀번호 찾기 (`/forgot-password`)
- 등록된 전화번호로 본인 인증 후 비밀번호 재설정

#### 소셜 온보딩 (`/social-onboarding`)
- 소셜 로그인 최초 사용 시 추가 정보 입력
- 2초 환영 화면 후 정보 입력 폼으로 전환

### 2.2 메인 기능

#### 홈 (`/home`)
- 대시보드 형태의 메인 화면
- 오늘의 경기 및 주요 정보 표시

#### 경기 예측 (`/prediction`)
- 실시간 야구 경기 예측 참여
- WebSocket 기반 실시간 업데이트
- 라운드별 예측 시스템
- 승리 시 포인트 획득

#### 출석체크 (`/attendance`)
- 일일 출석 체크로 포인트 획득
- 연속 출석 보너스

#### 게시판 (`/board`)
- 커뮤니티 게시판
- 게시글 목록 조회

#### 글쓰기 (`/create-post`)
- 새 게시글 작성
- 이미지 첨부 가능

#### 게시글 상세 (`/post/:id`)
- 게시글 내용 및 댓글 조회/작성

#### 포인트 (`/point`)
- 현재 보유 포인트 확인
- 포인트 사용 및 관리

#### 포인트 내역 (`/point-history`)
- 포인트 획득/사용 내역 조회

### 2.3 설정 메뉴

#### 설정 (`/settings`)
- 앱 설정 메뉴 허브

#### 프로필 (`/settings/profile`)
- 개인정보 수정
- 비밀번호 변경

#### 고객센터 (`/settings/customer-center`)
- 문의 내역 조회
- 1:1 문의하기

#### 문의하기 (`/settings/inquiry/create`)
- 새 문의 등록

#### 문의 상세 (`/settings/inquiry/:id`)
- 문의 답변 확인

#### 공지사항 (`/settings/notice`)
- 공지사항 목록

#### 공지 상세 (`/settings/notice/:id`)
- 공지사항 내용 확인

#### 이용약관 (`/settings/terms`)
- 서비스 이용약관 확인

#### FAQ (`/settings/faq`)
- 자주 묻는 질문

#### 기부 내역 (`/settings/donation-history`)
- 기부 포인트 내역 조회

#### 전자책 (`/settings/ebook`)
- 전자책 콘텐츠 열람

#### 승리 내역 (`/settings/victory-history`)
- 경기 예측 승리 기록

#### 초대하기 (`/settings/invite`)
- 친구 초대 코드 공유
- 초대 현황 확인

---

## 3. 테크니컬 매뉴얼

### 3.1 기술 스택

| 구분 | 기술 |
|------|------|
| 프레임워크 | React 18 + TypeScript |
| 빌드 도구 | Vite |
| 라우팅 | Wouter |
| 상태관리 | TanStack Query v5 |
| 폼 관리 | React Hook Form + Zod |
| 스타일링 | Tailwind CSS + shadcn/ui |
| 모바일 앱 | Capacitor (iOS/Android) |

### 3.2 파일 구조

```
client/src/
├── pages/
│   ├── auth/
│   │   ├── login.tsx          # 로그인 페이지
│   │   ├── signup.tsx         # 회원가입 페이지
│   │   ├── forgot-password.tsx # 비밀번호 찾기
│   │   └── social-onboarding.tsx # 소셜 온보딩
│   ├── setting/
│   │   ├── settings.tsx       # 설정 메인
│   │   ├── profile.tsx        # 프로필
│   │   ├── customer-center.tsx # 고객센터
│   │   ├── inquiry-create.tsx # 문의 작성
│   │   ├── inquiry-detail.tsx # 문의 상세
│   │   ├── notice.tsx         # 공지사항
│   │   ├── notice-detail.tsx  # 공지 상세
│   │   ├── terms-of-service.tsx # 이용약관
│   │   ├── faq.tsx            # FAQ
│   │   ├── donation-history.tsx # 기부 내역
│   │   ├── ebook.tsx          # 전자책
│   │   ├── victory-history.tsx # 승리 내역
│   │   └── invite.tsx         # 초대하기
│   ├── home.tsx               # 홈
│   ├── prediction.tsx         # 경기 예측
│   ├── attendance.tsx         # 출석체크
│   ├── board.tsx              # 게시판
│   ├── create-post.tsx        # 글쓰기
│   ├── post-detail.tsx        # 게시글 상세
│   ├── point.tsx              # 포인트
│   └── point-history.tsx      # 포인트 내역
├── UserApp.tsx                # 유저 앱 진입점
├── contexts/
│   └── UserContext.tsx        # 유저 상태 관리
└── lib/
    ├── queryClient.ts         # API 클라이언트
    └── tokenManager.ts        # JWT 토큰 관리
```

### 3.3 인증 흐름

1. **일반 로그인**: POST `/api/users/login` → JWT Access/Refresh Token 발급
2. **소셜 로그인**: GET `/api/auth/{provider}` → OAuth 콜백 → 딥링크로 토큰 전달
3. **자동 로그인**: Refresh Token으로 POST `/api/users/refresh`
4. **토큰 저장**: Capacitor Preferences (네이티브) 또는 localStorage (웹)

### 3.4 실시간 통신

- **WebSocket 엔드포인트**: `/ws/match`
- **이벤트 타입**: `prediction_started`, `prediction_result`, `match_status`
- **연결 관리**: 자동 재연결, 토큰 기반 인증

### 3.5 API 엔드포인트

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| POST | `/api/users/login` | 로그인 |
| POST | `/api/users/register` | 회원가입 |
| POST | `/api/users/refresh` | 토큰 갱신 |
| GET | `/api/users/me` | 내 정보 조회 |
| GET | `/api/matches` | 경기 목록 |
| POST | `/api/predictions` | 예측 제출 |
| GET | `/api/attendance` | 출석 정보 |
| POST | `/api/attendance/check` | 출석 체크 |
| GET | `/api/posts` | 게시글 목록 |
| POST | `/api/posts` | 게시글 작성 |

### 3.6 모바일 앱 빌드

```bash
# 웹 빌드
npm run build

# Capacitor 동기화
npx cap sync android
npx cap sync ios

# 네이티브 IDE 열기
npx cap open android
npx cap open ios
```

### 3.7 딥링크 스킴

- **스킴**: `ppadun9://`
- **소셜 로그인 콜백**: `ppadun9://auth?code={one-time-code}`
