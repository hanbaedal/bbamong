# ppamong 프로젝트 — 진행 상황 정리

> 최종 갱신: 2026년 6월  
> GitHub: https://github.com/hanbaedal/bbamong (`main`)

---

## 1. 프로젝트 방향

| 항목 | 내용 |
|------|------|
| **서비스·도메인** | `ppamong.com` (신규 서비스) |
| **레거시** | `ppadun9.com` — 사용하지 않음 |
| **작업 폴더** | `C:\PPADUN9\web` (본체) |
| **호스팅** | **Replit** (Autoscale Deploy) |
| **DB** | **MongoDB Atlas** (`ppamong` DB) |

---

## 2. 시스템 구조 (3클라이언트 + 1서버)

| 역할 | 사용 방식 | URL |
|------|-----------|-----|
| **일반 사용자** | Android / iOS 앱 (WebView) | `/login`, `/home`, `/prediction` … |
| **운영자(매니저)** | 별도 Android / iOS 앱 | `/manager/*` |
| **관리자** | 웹 브라우저만 | `/admin/*` |

```
C:\PPADUN9\
├── web\                    ★ 본체 (GitHub, Replit)
│   ├── client\             User + Manager + Admin UI
│   ├── server\             API + MongoDB + Redis
│   ├── android-manager\    매니저 Android
│   └── ios-manager-standalone\  매니저 iOS
├── android\                사용자 Android (로컬, GitHub 밖)
└── ios\                    사용자 iOS (로컬, GitHub 밖)
```

상세: [PPAMONG_프로젝트_구조.md](./PPAMONG_프로젝트_구조.md)

---

## 3. GitHub 커밋 이력 (요약)

| 커밋 | 내용 |
|------|------|
| `a645798` | 초기 소스 (PPADUN9 full-stack) |
| `7c96875` | `ppamong.com` 리브랜딩 + MongoDB Atlas 마이그레이션 |
| `3038a78` | 프로젝트 구조·배포 문서, `.env.example`, `README` |

---

## 4. 코드 변경 요약

### 4-1. 도메인 리브랜딩 (`ppamong.com`)

- `.replit` — `BASE_URL`
- `server/index.ts` — CORS
- `capacitor.config.ts`, `capacitor.config.manager.ts`
- `client` — API URL, WebSocket URL
- `server/UserRoutes/socialAuthRoutes.ts` — OAuth base URL

### 4-2. MongoDB 마이그레이션

**신규**

- `server/mongodb/connect.ts` — `MONGODB_URI` 연결
- `server/mongodb/counter.ts` — 시퀀스 ID
- `server/mongodb/models.ts` — Mongoose 모델

**전환 완료**

- `server/UserStorage/*`, `server/storage/*`
- `server/liveMatch/*`, 배치 작업, 미들웨어
- `server/UserRoutes/userRoutes.ts`, `ebookRoutes.ts`, `socialAuthRoutes.ts`
- `server/index.ts` — `connectMongoDB()` 호출

**레거시 (런타임 미사용)**

- `shared/schema.ts` — Zod 타입용 유지
- `drizzle.config.ts` — `npm run db:push`용만
- ~~`DATABASE_URL`~~ → **`MONGODB_URI`**

**미변경 (선택 리브랜딩)**

- 앱 ID `com.bbanden.nine`, `com.ppadun9.manager`
- 딥링크 `ppadun9://`, `ppadun9manager://`

### 4-3. PostgreSQL 데이터

- 기존 DB → MongoDB **이관 스크립트 없음** (새 DB로 시작)

---

## 5. 문서 목록

| 문서 | 용도 |
|------|------|
| [PPAMONG_진행_정리.md](./PPAMONG_진행_정리.md) | 이 문서 — 전체 진행 상황 |
| [PPAMONG_프로젝트_구조.md](./PPAMONG_프로젝트_구조.md) | 3클라이언트 구조·빌드 |
| [PPAMONG_DEPLOY_CHECKLIST.md](./PPAMONG_DEPLOY_CHECKLIST.md) | Replit·Atlas·OAuth·Secrets |
| [PPAMONG_가비아_DNS_설정.md](./PPAMONG_가비아_DNS_설정.md) | 가비아 DNS + Replit 연결 |
| [MANAGER_ANDROID_BUILD.md](./MANAGER_ANDROID_BUILD.md) | 매니저 Android 빌드 |
| `PPADUN9_소스분석.md` / `.docx` | 초기 소스 분석 (로컬) |

---

## 6. Replit / Atlas (설정 완료)

### Replit Secrets (필수)

| Secret | 설명 |
|--------|------|
| `MONGODB_URI` | Atlas 연결 문자열 (`/ppamong` 포함) |
| `JWT_SECRET` | 로그인 토큰 서명 (32자+ 랜덤) |
| `JWT_REFRESH_SECRET` | 리프레시 토큰 (JWT와 다른 값) |
| `NODE_ENV` | `production` (Deploy 시) |

### MongoDB Atlas

- 사용자: `ppamong_db_user` (SCRAM)
- Network: `0.0.0.0/0` (Replit)
- DB: `ppamong`
- 운영 권장: 역할 `readWrite@ppamong` (현재 `atlasAdmin`은 개발용)

### Replit 호환성

- **85~90%** — 원래 Replit용으로 제작됨
- Object Storage, Redis, WebSocket, Autoscale Deploy 지원
- 영상 업로드 시: `PUBLIC_OBJECT_SEARCH_PATHS`, `PRIVATE_OBJECT_DIR` 추가 필요

---

## 7. 완료 / 미완료 체크리스트

### 완료

- [x] `web` 소스 `ppamong.com` 반영
- [x] MongoDB Atlas 마이그레이션 (코드)
- [x] GitHub `hanbaedal/bbamong` push
- [x] Replit Secrets (MongoDB, JWT)
- [x] 프로젝트 구조·배포 문서 작성

### 미완료

- [ ] Replit **Deploy** (Autoscale)
- [ ] **가비아 DNS** → `ppamong.com` (A + TXT)
- [ ] `https://ppamong.com` 접속 확인
- [ ] OAuth Redirect URI 등록
- [ ] Object Storage Secrets (영상 기능)
- [ ] 사용자 앱 `android` / `ios` 빌드
- [ ] 매니저 앱 빌드
- [ ] (선택) 앱 ID·딥링크 ppamong 리브랜딩

---

## 8. 다음 단계 (권장 순서)

```text
1. Replit Deploy (Autoscale) → 로그 확인
2. Publishing → Domains → ppamong.com
   - 자동 연결(가비아 로그인) 또는 A+TXT 수동
3. 가비아 DNS 저장 → Replit Verified
4. https://ppamong.com/admin/login 테스트
5. OAuth·SOLAPI·Object Storage (필요 시)
6. 사용자/매니저 앱 빌드·스토어 등록
```

DNS 상세: [PPAMONG_가비아_DNS_설정.md](./PPAMONG_가비아_DNS_설정.md)

---

## 9. 로컬 개발

```powershell
cd C:\PPADUN9\web
# .env: MONGODB_URI, JWT_SECRET, JWT_REFRESH_SECRET
npm install
npm run dev
```

콘솔: `[MongoDB] Connected to Atlas (ppamong)`

---

## 10. 한 줄 요약

**`web`을 ppamong.com + MongoDB + Replit 기준으로 전환했고 GitHub·Secrets까지 맞춰 둔 상태. 남은 핵심은 Deploy → 가비아 DNS → 도메인 연결 확인.**
