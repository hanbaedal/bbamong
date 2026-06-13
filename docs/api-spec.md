# API 명세서

> **Base URL**: `https://ppadun9.com`  
> **인증 방식**: Bearer Token (JWT) — `Authorization: Bearer <accessToken>` 헤더  
> **WebSocket**: `wss://ppadun9.com/ws/match?token=<accessToken>`

---

## 목차
1. [인증 (Auth)](#1-인증-auth)
2. [유저 정보](#2-유저-정보)
3. [출석](#3-출석)
4. [포인트 거래 내역](#4-포인트-거래-내역)
5. [게시판 (Posts)](#5-게시판-posts)
6. [문의 (Inquiries)](#6-문의-inquiries)
7. [공지사항 / 약관 / FAQ](#7-공지사항--약관--faq)
8. [이북 (Ebooks)](#8-이북-ebooks)
9. [전화번호 인증](#9-전화번호-인증)
10. [소셜 로그인](#10-소셜-로그인)
11. [경기 목록](#11-경기-목록)
12. [라이브 예측](#12-라이브-예측)
13. [WebSocket 이벤트](#13-websocket-이벤트)
14. [매니저 API](#14-매니저-api)
15. [관리자 API](#15-관리자-api)

---

## 1. 인증 (Auth)

### POST `/api/check-username`
아이디 중복 확인

**Request**
```json
{ "username": "string" }
```
**Response 200**
```json
{ "available": true, "message": "사용 가능한 아이디입니다." }
```

---

### POST `/api/signup`
회원가입

**Request**
```json
{
  "username": "string",
  "password": "string (optional, social은 생략)",
  "name": "string (최대 15자)",
  "phone": "string (optional)",
  "email": "string (optional)",
  "provider": "local | kakao | google | apple | guest",
  "providerId": "string (optional)",
  "referralCode": "string (optional)"
}
```
**Response 201**
```json
{
  "success": true,
  "user": { /* User 객체, password 제외 */ }
}
```

---

### POST `/api/login`
일반 로그인

**Request**
```json
{ "username": "string", "password": "string" }
```
**Response 200**
```json
{
  "success": true,
  "accessToken": "string",
  "refreshToken": "string",
  "user": { /* User 객체, password 제외 */ }
}
```
**Error 401** 아이디/비밀번호 불일치  
**Error 403** 정지된 계정 (`suspended`)

---

### POST `/api/guest-login`
게스트 로그인

**Request**
```json
{ "guestId": "string (optional, 기존 게스트 계정 재사용)" }
```
**Response 200** — 로그인과 동일 구조

---

### POST `/api/logout`
로그아웃 (인증 필요)

**Response 200**
```json
{ "success": true, "message": "로그아웃 되었습니다." }
```

---

### POST `/api/token/refresh`
Access Token 갱신

**Request**
```json
{ "refreshToken": "string" }
```
**Response 200**
```json
{ "accessToken": "string", "refreshToken": "string" }
```

---

### POST `/api/password-reset/send-code`
비밀번호 찾기 — 인증번호 전송

**Request**
```json
{ "phone": "string" }
```
**Response 200**
```json
{ "success": true, "message": "인증번호가 전송되었습니다.", "expiresIn": 180 }
```

---

### POST `/api/password-reset/verify-code`
비밀번호 찾기 — 인증번호 확인

**Request**
```json
{ "phone": "string", "code": "string" }
```
**Response 200**
```json
{ "success": true, "verified": true }
```

---

### POST `/api/password-reset/reset`
비밀번호 재설정

**Request**
```json
{ "phone": "string", "newPassword": "string" }
```
**Response 200**
```json
{ "success": true, "message": "비밀번호가 변경되었습니다." }
```

---

## 2. 유저 정보

### GET `/api/users/me`
내 정보 조회 (인증 필요)

**Response 200**
```json
{
  "id": "uuid",
  "username": "string",
  "name": "string",
  "phone": "string",
  "email": "string",
  "provider": "local | kakao | google | apple | guest",
  "points": 0,
  "inviteCode": "string",
  "hasPassword": true,
  "totalDonationAmount": 0,
  "createdAt": "timestamp"
}
```

---

### PATCH `/api/users/me`
내 정보 수정 (인증 필요)

**Request** (수정할 필드만)
```json
{
  "name": "string (optional)",
  "phone": "string (optional)",
  "email": "string (optional)",
  "password": "string (optional)",
  "currentPassword": "string (비밀번호 변경 시 필수)"
}
```
**Response 200** — 수정된 User 객체

---

### DELETE `/api/users/me`
회원 탈퇴 — 소프트 삭제, 7일 후 영구 삭제 (인증 필요)

**Response 200**
```json
{ "success": true, "message": "계정이 삭제되었습니다." }
```

---

## 3. 출석

### GET `/api/attendance/status?userId=<id>`
오늘 출석 여부 조회

**Response 200**
```json
{
  "isAttended": false,
  "attendanceCount": 5,
  "lastAttendanceDate": "timestamp"
}
```

---

### POST `/api/attendance/check-in`
출석 체크인 (포인트 지급)

**Request**
```json
{ "userId": "string" }
```
**Response 200**
```json
{ "success": true, "message": "출석 완료!", "points": 100 }
```
**Error 400** — 이미 출석 완료

---

## 4. 포인트 거래 내역

### GET `/api/point-transactions/:userId?limit=20&offset=0`
포인트 거래 내역 조회

**Response 200**
```json
[
  {
    "id": 1,
    "userId": "uuid",
    "transactionType": "earned | spent | donation | donated_spent",
    "amount": 100,
    "balance": 500,
    "description": "string",
    "createdAt": "timestamp"
  }
]
```

---

### GET `/api/total-points/:userId`
총 포인트 조회

**Response 200**
```json
{ "userId": "string", "totalPoints": 500 }
```

---

## 5. 게시판 (Posts)

### GET `/api/posts?page=1&limit=10&search=키워드`
게시글 목록

**Response 200**
```json
{
  "data": [ /* Post[] */ ],
  "total": 100,
  "page": 1,
  "limit": 10,
  "totalPages": 10
}
```

---

### POST `/api/posts`
게시글 작성 (인증 필요, 게스트 불가)

**Request**
```json
{ "title": "string", "content": "string", "authorId": "uuid" }
```
**Response 201** — 생성된 Post 객체

---

### GET `/api/posts/:id`
게시글 상세 (조회수 증가)

**Response 200** — Post 객체 + 댓글 목록

---

### PATCH `/api/posts/:id`
게시글 수정 (작성자 본인)

**Response 200** — 수정된 Post 객체

---

### DELETE `/api/posts/:id`
게시글 삭제

**Response 200**
```json
{ "success": true }
```

---

### GET `/api/posts/:id/comments`
댓글 목록

**Response 200** — Comment[]

---

### POST `/api/posts/:id/comments`
댓글 작성 (인증 필요)

**Request**
```json
{ "authorId": "uuid", "content": "string" }
```
**Response 201** — 생성된 Comment 객체

---

### DELETE `/api/comments/:id`
댓글 삭제

**Response 200**
```json
{ "success": true }
```

---

## 6. 문의 (Inquiries)

### GET `/api/inquiries?userId=<id>`
내 문의 목록

**Response 200** — Inquiry[]

---

### POST `/api/inquiries`
문의 등록 (인증 필요)

**Request**
```json
{
  "userId": "uuid",
  "category": "계정 문제 | 게임 문제 | 기술적 문제 | 기타",
  "title": "string",
  "content": "string"
}
```
**Response 201** — 생성된 Inquiry 객체

---

### GET `/api/inquiries/:id`
문의 상세

**Response 200** — Inquiry 객체

---

### PATCH `/api/inquiries/:id`
문의 상태/답변 수정 (관리자)

**Request**
```json
{
  "status": "pending | in_progress | resolved",
  "response": "string (optional)"
}
```

---

### DELETE `/api/inquiries/:id`
문의 삭제

**Response 200**
```json
{ "success": true }
```

---

## 7. 공지사항 / 약관 / FAQ

### GET `/api/notices?page=1&limit=10`
공지사항 목록

### GET `/api/notices/:id`
공지사항 상세

### GET `/api/terms`
약관 목록

### GET `/api/terms/type/:type`
약관 타입별 조회 (`type`: `service`, `privacy`)

### GET `/api/terms/:id`
약관 상세

### GET `/api/faqs`
FAQ 목록

---

## 8. 이북 (Ebooks)

### GET `/api/ebooks`
이북 목록

**Response 200**
```json
[{ "id": 1, "name": "string", "price": 1000 }]
```

---

### POST `/api/ebook-purchases`
이북 구매 (인증 필요)

**Request**
```json
{ "ebookId": 1 }
```
**Response 200**
```json
{ "success": true, "purchase": { /* EbookPurchase */ } }
```

---

## 9. 전화번호 인증

### POST `/api/phone/send-code`
인증번호 전송 (SMS)

**Request**
```json
{ "phone": "01012345678", "type": "signup | find-password" }
```
**Response 200**
```json
{ "success": true, "message": "인증번호가 전송되었습니다.", "expiresIn": 180 }
```

---

### POST `/api/phone/verify-code`
인증번호 확인

**Request**
```json
{ "phone": "01012345678", "code": "123456" }
```
**Response 200**
```json
{ "success": true, "verified": true }
```

---

### GET `/api/phone/check-verified/:phone`
인증 상태 확인 (30분 유효)

**Response 200**
```json
{ "verified": true }
```

---

## 10. 소셜 로그인

딥링크 기반 일회성 코드 교환 방식 사용

### POST `/api/auth/kakao`
카카오 로그인

**Request**
```json
{ "code": "string (일회성 auth code)" }
```
**Response 200** — 로그인과 동일 구조 (`accessToken`, `refreshToken`, `user`)

### POST `/api/auth/google`
구글 로그인 (`prompt: 'select_account'`)

### POST `/api/auth/apple`
애플 로그인

---

## 11. 경기 목록

### GET `/api/matches`
오늘의 경기 목록 (진행 중 / 예정)

**Response 200**
```json
[
  {
    "id": "uuid",
    "name": "string",
    "stadiumId": 1,
    "matchDate": "2026-06-09",
    "startTime": "timestamp",
    "endTime": "timestamp",
    "matchStatus": "scheduled | ongoing | completed | cancelled",
    "currentRound": 1,
    "predictionEnabled": false
  }
]
```

---

## 12. 라이브 예측

### POST `/api/live-match/predictions`
예측 제출 (인증 필요, 포인트 100 차감)

**Request**
```json
{
  "matchId": "uuid",
  "prediction": "1루 | 2루 | 3루 | 홈런 | 아웃",
  "amount": 100
}
```
**Response 201**
```json
{
  "id": 1,
  "matchId": "uuid",
  "roundNumber": 1,
  "prediction": "홈런",
  "amount": 100,
  "status": "pending"
}
```
**Error 400** — 이미 예측함 / 포인트 부족 / 예측 비활성화

---

### GET `/api/live-match/predictions/:matchId/check`
내 예측 상태 확인 (인증 필요)

**Response 200**
```json
{
  "hasPrediction": true,
  "predictionId": 1,
  "prediction": "홈런",
  "amount": 100,
  "roundNumber": 1,
  "status": "pending | success | fail",
  "wonAmount": 0,
  "predictionEnabled": true
}
```

---

### GET `/api/live-match/predictions/:id`
예측 상세 조회

**Response 200** — Prediction 객체 전체

---

### POST `/api/live-match/predictions/:id/donate`
상금 10% 기부 (인증 필요, 성공 예측만)

**Response 200**
```json
{ "success": true, "donationAmount": 50 }
```
> `donationAmount === 0` 이면 기부 불가 (prize = 0인 경우, 모든 유저가 같은 팀 예측)

---

### GET `/api/live-match/stats/:matchId`
경기 실시간 통계

**Response 200**
```json
{
  "totalParticipants": 100,
  "totalPredictionPoints": 10000,
  "currentRound": 3,
  "totalWinners": 45,
  "totalDistributedPoints": 9500,
  "currentRoundParticipants": 30,
  "currentRoundPoints": 3000,
  "predictionEnabled": true
}
```

---

## 13. WebSocket 이벤트

**연결**: `wss://ppadun9.com/ws/match?token=<accessToken>`  
**연결 후**: `{ "type": "join_match", "matchId": "uuid" }` 전송

### 서버 → 클라이언트 이벤트

| type | 설명 | data 주요 필드 |
|------|------|----------------|
| `user_already_predicted` | WS 연결 시 기존 예측 복원 | `prediction`, `predictionId`, `round`, `status`, `wonAmount`, `amount`, `fromPreviousRound?` |
| `prediction_started` | 예측 시작 | `matchId`, `currentRound`, `predictionEnabled: true` |
| `prediction_stopped` | 예측 중지 | `matchId`, `currentRound` |
| `round_result` | 라운드 결과 (개인화) | `matchId`, `roundNumber`, `result`, `wonAmount` (본인 획득 포인트) |
| `round_next` | 다음 라운드 이동 | `matchId`, `currentRound`, `predictionEnabled` |
| `match_ended` | 경기 종료 | `matchId` |
| `ad_started` | 광고 시작 | `matchId`, `adStartedAt` |
| `ad_ended` | 광고 종료 | `matchId` |
| `waiting_screen` | 대기 화면 | `videoUrl`, `displayDuration` |

> WS close code `4005` = 세션 종료(다른 기기 로그인) → 자동 재연결

---

## 14. 매니저 API

### POST `/api/manager/login`
매니저 로그인

**Request**
```json
{ "email": "string", "password": "string" }
```
**Response 200**
```json
{ "accessToken": "string", "refreshToken": "string", "manager": { /* AdminUser */ } }
```
**Error 409** — 이미 다른 기기에서 로그인 중

---

### POST `/api/manager/logout`
매니저 로그아웃

---

### GET `/api/manager/me`
매니저 본인 정보

---

### GET `/api/manager/matches/today`
오늘 할당된 경기 목록

**Response 200** — Match[]

---

### POST `/api/manager/matches/:id/prediction/start`
예측 시작

**Response 200**
```json
{ "success": true, "currentRound": 1 }
```

---

### POST `/api/manager/matches/:id/prediction/stop`
예측 중지

**Response 200**
```json
{ "success": true }
```

---

### POST `/api/manager/matches/:id/result`
라운드 결과 입력 → 자동으로 다음 라운드 이동

**Request**
```json
{ "result": "1루 | 2루 | 3루 | 홈런 | 아웃" }
```
**Response 200**
```json
{
  "success": true,
  "roundNumber": 1,
  "result": "홈런",
  "nextRound": 2
}
```

---

## 15. 관리자 API

> 모든 관리자 API는 관리자 JWT 인증 필요

### 관리자 인증

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/admin/check-phone` | 전화번호 중복 확인 |
| POST | `/api/admin/signup` | 관리자 회원가입 (승인 대기) |
| POST | `/api/admin/login` | 관리자 로그인 |
| POST | `/api/admin/logout` | 로그아웃 |
| GET | `/api/admin/me` | 내 정보 |
| POST | `/api/admin/token/refresh` | 토큰 갱신 |

---

### 유저 관리

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/admin/regular-users?page=1&limit=8` | 일반 유저 목록 |
| GET | `/api/admin/regular-users/:id` | 유저 상세 |
| PATCH | `/api/admin/users/:id` | 유저 정보 수정 |
| PATCH | `/api/admin/users/:id/suspend` | 유저 정지(소프트 삭제) |
| DELETE | `/api/admin/users/:id` | 유저 즉시 삭제 |

---

### 관리자 계정 관리

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/admin/admins?page=1&limit=8` | 관리자 목록 |
| PATCH | `/api/admin/admins/:id/approval` | 승인/거부 (`approvalStatus`) |
| DELETE | `/api/admin/admins/:id` | 관리자 삭제 |

---

### 경기 관리

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/admin/matches?page=1&limit=8` | 경기 목록 |
| POST | `/api/admin/matches/batch` | 경기 일괄 등록/수정 (UPSERT) |
| PUT | `/api/admin/matches/:id` | 경기 수정 |
| DELETE | `/api/admin/matches/:id` | 경기 삭제 |

**batch Request**
```json
[
  {
    "id": "uuid (optional, UPSERT)",
    "name": "string",
    "stadiumId": 1,
    "matchDate": "2026-06-09",
    "startTime": "timestamp",
    "endTime": "timestamp",
    "matchStatus": "scheduled"
  }
]
```

---

### 경기장 관리

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/admin/stadiums` | 경기장 목록 |
| POST | `/api/admin/stadiums` | 경기장 등록 |
| DELETE | `/api/admin/stadiums/:id` | 경기장 삭제 |

---

### 매니저 관리

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/admin/admin-managers?page=1&limit=8` | 매니저 목록 |
| PATCH | `/api/admin/admin-managers/:id/approve` | 매니저 승인 |
| DELETE | `/api/admin/admin-managers/:id` | 매니저 삭제 |
| GET | `/api/admin/manager-match-assignments` | 매니저-경기 할당 목록 |
| POST | `/api/admin/manager-match-assignments/assign` | 경기 할당 `{managerId, matchNumber}` |
| POST | `/api/admin/manager-match-assignments/unassign` | 할당 해제 `{managerId}` |
| PATCH | `/api/admin/manager-match-assignments/:managerId/status` | 매니저 활성/비활성 |

---

### 문의 관리

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/admin/inquiries?status=pending&page=1` | 전체 문의 목록 |
| PATCH | `/api/admin/inquiries/:id` | 답변/상태 변경 |

---

### 공지 / 약관 / FAQ 관리

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/admin/notices` | 공지 등록 |
| PATCH | `/api/admin/notices/:id` | 공지 수정 |
| DELETE | `/api/admin/notices/:id` | 공지 삭제 |
| POST | `/api/admin/terms` | 약관 등록 |
| PATCH | `/api/admin/terms/:id` | 약관 수정 |
| POST | `/api/admin/faqs` | FAQ 등록 |
| PATCH | `/api/admin/faqs/:id` | FAQ 수정 |
| DELETE | `/api/admin/faqs/:id` | FAQ 삭제 |

---

### 광고 / 대기화면 관리

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/admin/advertisements?page=1` | 광고 목록 |
| POST | `/api/admin/advertisements/upload` | 업로드 URL 발급 |
| POST | `/api/admin/advertisements` | 광고 등록 |
| PATCH | `/api/admin/advertisements/:id` | 광고 수정 |
| DELETE | `/api/admin/advertisements/:id` | 광고 삭제 |
| GET | `/api/admin/waiting-screens?page=1` | 대기화면 목록 |
| POST | `/api/admin/waiting-screens/upload` | 업로드 URL 발급 |
| POST | `/api/admin/waiting-screens` | 대기화면 등록 |
| PATCH | `/api/admin/waiting-screens/:id` | 수정 |
| DELETE | `/api/admin/waiting-screens/:id` | 삭제 |

---

### 랭킹 / 기부 / AdMob

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/rankings/victory?page=1&limit=8` | 승리 횟수 랭킹 (상위 100명) |
| GET | `/api/rankings/points?page=1&limit=8` | 포인트 랭킹 |
| GET | `/api/admin/donation-rankings?page=1` | 기부 랭킹 |
| GET | `/api/admin/admob/revenue-report` | AdMob 수익 리포트 |

---

## 공통 에러 코드

| HTTP | 설명 |
|------|------|
| 400 | 잘못된 요청 / 유효성 검사 실패 |
| 401 | 인증 필요 / 토큰 만료 |
| 403 | 권한 없음 / 정지된 계정 |
| 404 | 리소스 없음 |
| 409 | 충돌 (중복 로그인, 중복 데이터) |
| 500 | 서버 내부 오류 |
