# 매니저 앱 매뉴얼

## 1. 개요

매니저 앱은 경기 진행을 담당하는 매니저가 실시간으로 경기 결과를 입력하고 관리하는 애플리케이션입니다.

---

## 2. 사용자 매뉴얼

### 2.1 인증

#### 로그인 (`/manager/login`)
- 매니저 전용 계정으로 로그인
- 승인된 매니저만 접속 가능

#### 회원가입 (`/manager/signup`)
- 매니저 계정 신청
- 관리자 승인 후 사용 가능

#### 승인 대기 (`/manager/pending-approval`)
- 관리자 승인 대기 상태 안내
- 승인 완료 시 자동으로 홈으로 이동

### 2.2 메인 기능

#### 홈 (`/manager/home`)
- 배정된 경기 목록 확인
- 오늘의 담당 경기 표시
- 경기 상태별 필터링

#### 경기 상세 (`/manager/match/:id`)
- 실시간 경기 결과 입력
- 라운드별 점수 입력
- 경기 시작/종료 제어
- 예측 라운드 시작/종료
- 실시간 참여자 현황 확인

### 2.3 경기 진행 워크플로우

1. **경기 선택**: 홈에서 담당 경기 선택
2. **경기 시작**: "경기 시작" 버튼 클릭
3. **예측 라운드 시작**: 각 이닝마다 예측 라운드 시작
4. **결과 입력**: 이닝 종료 후 결과 입력
5. **예측 라운드 종료**: 결과 확정 및 포인트 정산
6. **반복**: 9이닝까지 반복
7. **경기 종료**: 최종 결과 확정

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

### 3.2 파일 구조

```
client/src/
├── managerPages/
│   ├── auth/
│   │   ├── login.tsx           # 매니저 로그인
│   │   ├── signup.tsx          # 매니저 회원가입
│   │   └── pending-approval.tsx # 승인 대기
│   ├── home.tsx                # 매니저 홈
│   └── matchDetail.tsx         # 경기 상세/진행
├── ManagerApp.tsx              # 매니저 앱 진입점
└── contexts/
    └── ManagerAssetContext.tsx # 매니저 에셋 관리
```

### 3.3 인증 흐름

1. **로그인**: POST `/api/manager/login` → JWT 토큰 발급
2. **승인 체크**: 로그인 시 `isApproved` 필드 확인
3. **미승인 시**: `/manager/pending-approval`로 리다이렉트
4. **세션 관리**: Redis 기반 중복 로그인 방지

### 3.4 API 엔드포인트

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| POST | `/api/manager/login` | 매니저 로그인 |
| POST | `/api/manager/register` | 매니저 등록 |
| GET | `/api/manager/matches` | 배정된 경기 목록 |
| GET | `/api/manager/match/:id` | 경기 상세 정보 |
| POST | `/api/manager/match/:id/start` | 경기 시작 |
| POST | `/api/manager/match/:id/end` | 경기 종료 |
| POST | `/api/manager/match/:id/round/start` | 라운드 시작 |
| POST | `/api/manager/match/:id/round/result` | 라운드 결과 입력 |

### 3.5 WebSocket 이벤트

매니저가 발생시키는 이벤트:
- `match_started`: 경기 시작
- `prediction_started`: 예측 라운드 시작
- `prediction_result`: 라운드 결과 발표
- `match_ended`: 경기 종료

### 3.6 권한 체계

- **일반 매니저**: 배정된 경기만 진행 가능
- **승인 상태**: 관리자 승인 필수
- **세션 제한**: 동시 로그인 1개로 제한
