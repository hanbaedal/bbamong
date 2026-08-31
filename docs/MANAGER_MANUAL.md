# 매니저(운영자) 앱 매뉴얼

## 1. 개요

매니저 앱은 배정된 KBO 경기의 **타석 예측 라운드**를 운영합니다.  
실황(다음·네이버)이 기본으로 타석을 진행하고, **운영자가 버튼을 먼저 누르면 그게 우선**입니다. 완전자동/반자동 선택 토글은 없습니다.

---

## 2. 사용자 매뉴얼

### 2.1 인증

#### 로그인 (`/manager/login`)
- 카카오톡 **로그인 링크**로만 접속 (앱/웹)
- 같은 계정은 **한 기기만** 사용 가능
- 네트워크가 끊기면 **재로그인하지 말고 재연결**. 같은 기기 재로그인은 허용, 다른 기기는 거부
- 관리자 승인·배정이 된 운영자만 경기 상세 진입

#### 회원가입 / 승인 대기
- 신청 후 관리자 승인 필요 (`/manager/pending-approval`)

### 2.2 메인 기능

#### 홈 (`/manager/home`)
- 배정된 경기 목록·오늘 담당 경기

#### 경기 상세 (`/manager/match/:id`)
- 타석 단계 배지 · 「지금」 안내 · 실황 추정 결과 제안
- 수동: 예측 시작/중지 · 결과 전송 · 다음 타자 · 공수교대 · 투수교체 · 대타 · 라인업
- 광고: 투수교체·공수교대 = 시작 / 예측 시작 = 중지 (약 50초 후 자동 종료·보상)
- 자동 타이밍(참고): 실황 폴링 ~2초, 타자 안정화 2초, 투수 3초, 예측 열림 ~8초 후 자동 중지

### 2.3 경기 진행 워크플로우

1. **경기 선택** → 상세 입장 (처음부터가 원칙. 중간 입장도 됨 — 켜진 다음 버튼만)
2. 실황이 타석을 열고 닫고 결과를 제안·확정합니다. TV를 보며 **필요한 때만** 버튼을 누릅니다.
3. **예외 시 수동**
   - 애매한 결과 → 「실황 추정」 확인 후 전송 또는 다른 결과 선택
   - 가드 걸림 → 예측시작 → 중지 → 결과 → 다음타자(또는 공수교대)
4. **투수교체**: 같은 타석 유지(대타 유지). 진행 중 예측은 환불·결과 생략 가능. 광고 시작
5. **공수교대**: 3아웃 후. 광고 시작
6. **경기 종료**: 약 10초 「경기종료」 후 로그아웃

### 2.4 결과 선택 의미

| 선택 | 포함 |
|------|------|
| **아웃** | 아웃·희생플라이/번트·병살 등(아웃수 증가 시 자동) |
| **1루** | 1루타·포볼·데드볼 등 |
| **2루 / 3루 / 홈런** | 해당 진루·홈런. 회원 주루 연출에서 홈런은 1·2·3루를 돌아 홈 |

### 2.5 회원이 보는 화면 (운영자가 알 것)

1. 경기전 — 쿠어스 전경  
2. 대기 — 시네마틱 빠몽이 (초/말)  
3. 예측 선택 — 3D 구장 베이스 버튼  
4. 결과 대기 — 시네마틱 투수  
5. 결과 큰 글씨 (약 2.2초)  
6. 적중 시 주루 — 필리스 실사 (홈런=1·2·3루 후 홈)  
7. 다음 타석 대기/선택  

실패·투수교체·공수교대는 3D 구장을 유지합니다.

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
│   ├── home.tsx
│   └── matchDetail.tsx
├── ManagerApp.tsx
└── contexts/
```

### 3.3 실황·자동 진행

- 스코어·이닝: **다음 스포츠** `liveScoreboard` (auto 모드에서 덮어쓰기)
- 문자중계·주자·볼카운트: **네이버** 릴레이
- 타석 자동: `server/liveMatch/liveAutoOperator.ts` + `shared/atBatPhase.ts`
- 하이브리드: 자동 진행 + 운영자 수동이 먼저면 우선 (`notifyManualAtBatAction`)
- WS: `at_bat_phase`, `prediction_*`, `round_result`, `ad_*`, `prediction_cancelled` 등

### 3.4 API (요약)

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| POST | `/api/manager/login` | 로그인 |
| GET | `/api/manager/matches` | 배정 경기 |
| GET | `/api/manager/match/:id` | 상세 |
| POST | `/api/manager/matches/:id/prediction/start` | 예측 시작 |
| POST | `/api/manager/matches/:id/prediction/stop` | 예측 중지 |
| POST | `/api/manager/matches/:id/result` | 결과 |
| POST | `/api/manager/control/:id/round/next-batter` | 다음 타자 |
| POST | `/api/manager/control/:id/round/switch-half` | 공수교대 |
| POST | `/api/manager/control/:id/round/pitcher-change` | 투수교체 |
| PATCH | `/api/manager/matches/:id/scoreboard` | 점수 보정 → manual |

### 3.5 권한·세션

- 배정 경기만 진행
- 동시 로그인 1개 (Redis)
- 경기 종료 시 지연 후 자격 회수·로그아웃
