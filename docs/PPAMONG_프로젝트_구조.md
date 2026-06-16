# ppamong 프로젝트 구조 및 운영 가이드

> **한 줄 요약:** 백엔드는 `web` 하나. 클라이언트는 **사용자 앱**, **매니저(운영자) 앱**, **관리자 웹** 세 가지.

---

## 1. 서비스 구성 (3가지 역할)

| 역할 | 누가 | 사용 방법 | URL (ppamong.com) |
|------|------|-----------|-------------------|
| **일반 사용자** | 참여자 | Android / iOS 앱 | `/login`, `/home`, `/prediction` … |
| **운영자(매니저)** | 경기 현장 운영 | Android / iOS 앱 (매니저 전용) | `/manager/login`, `/manager/home` … |
| **관리자(어드민)** | 본사·슈퍼어드민 | **웹 브라우저만** | `/admin/login`, `/admin/members` … |

백엔드(API·DB)는 **전부 한 서버** (`web/server` → Replit)에서 처리합니다.  
프론트는 같은 `web` 저장소 안에 React 앱이 **3벌**로 나뉩니다.

```
                    ┌─────────────────────────────────┐
                    │  ppamong.com (Replit / web)      │
                    │  Express API + MongoDB + Redis   │
                    └───────────────┬─────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                         │
    UserApp (앱)              ManagerApp (앱)           AdminApp (웹)
    /login, /home             /manager/*                /admin/*
```

`client/src/main.tsx`에서 URL 경로로 앱을 분기합니다.

- `/manager/*` → `ManagerApp`
- `/` 또는 `/admin/*` → `AdminApp`
- 그 외 → `UserApp` (로그인, 홈, 예측 등)

---

## 2. 폴더 구조

```
C:\PPADUN9\
│
├── web\                          ★ 본체 (GitHub: hanbaedal/bbamong, Replit)
│   ├── client\                   User + Manager + Admin React UI
│   ├── server\                   Express API, MongoDB, Redis
│   ├── shared\                   Zod 스키마 (타입)
│   ├── android-manager\          매니저 Android 네이티브 프로젝트
│   ├── ios-manager-standalone\   매ni저 iOS 네이티브 프로젝트
│   ├── capacitor.config.ts       사용자 앱 Capacitor 설정
│   ├── capacitor.config.manager.ts  매니저 앱 Capacitor 설정
│   └── docs\                     배포·구조 문서
│
├── android\                      사용자 Android (로컬, GitHub 미포함)
└── ios\                          사용자 iOS (로컬, GitHub 미포함)
```

### 역할별 네이티브 프로젝트

| 대상 | Android | iOS | App ID (현재) | 앱 시작 URL |
|------|---------|-----|---------------|-------------|
| **사용자** | `web\android` | (iOS 별도) | `com.ppamong.app` | `https://ppamong.com/login` |
| **매니저** | `web\android-manager` | `web\ios-manager-standalone` | `com.ppamong.manager` | `https://ppamong.com/manager` |
| **관리자** | 없음 | 없음 | — | 브라우저 `https://ppamong.com/admin` |

Capacitor **원격 URL 모드**: 앱은 WebView로 `ppamong.com`을 연다.  
화면·기능 변경은 주로 **Replit 배포(`web`)만** 하면 되고, 앱 재빌드는 스토어 출시·아이콘·딥링크 변경 시 필요.

---

## 3. Git / Replit / 배포 범위

| 항목 | 위치 | GitHub | Replit |
|------|------|--------|--------|
| 서버 + 3종 UI | `web` | ✅ `hanbaedal/bbamong` | ✅ Deploy 대상 |
| 사용자 Android/iOS | `PPADUN9\android`, `ios` | ❌ (로컬만) | ❌ |
| 매ni저 Android/iOS | `web\android-manager` 등 | ✅ web repo 안 | ❌ |

---

## 4. 진행 상황 체크리스트

### 완료된 것

- [x] `web` MongoDB Atlas 전환
- [x] `ppamong.com` 도메인 코드 반영
- [x] GitHub `bbamong` main push
- [x] Replit Secrets (`MONGODB_URI`, JWT 등)

### 남은 것

- [ ] Replit **Deploy** (Autoscale) + Custom domain `ppamong.com`
- [ ] DNS CNAME 등록
- [ ] OAuth Redirect URI (`https://ppamong.com/api/auth/...`)
- [ ] 관리자 웹 `/admin` 동작 확인
- [ ] 사용자 Android/iOS 앱 빌드·스토어 등록
- [ ] 매ni저 Android/iOS 앱 빌드·배포
- [ ] (선택) 앱 이름·ID·딥링크 ppamong 리브랜딩

---

## 5. Deploy + 관리자 웹 오픈 순서

### 5-1. Replit Deploy

1. Replit 프로젝트 열기 → **Deploy** → **Autoscale**
2. Build: `npm run build` / Run: `npm run start` (`.replit`에 설정됨)
3. Logs 확인:
   - `[MongoDB] Connected to Atlas (ppamong)`
   - `Redis Client Connected`
   - `serving on port 5000`

### 5-2. 커스텀 도메인

1. Deploy → **Custom domains** → `ppamong.com`, `www.ppamong.com` 추가
2. 도메인 업체에 Replit 안내 **CNAME** 등록
3. 전파 후 접속: `https://ppamong.com/admin/login`

### 5-3. Secrets (필수)

| Secret | 용도 |
|--------|------|
| `MONGODB_URI` | MongoDB Atlas |
| `JWT_SECRET` | 로그인 토큰 (직접 생성) |
| `JWT_REFRESH_SECRET` | 리프레시 토큰 (JWT와 다른 값) |
| `NODE_ENV` | `production` (Deploy 시) |

OAuth·SOLAPI는 로그인/문자 테스트 전에 추가.  
자세한 목록: [PPAMONG_DEPLOY_CHECKLIST.md](./PPAMONG_DEPLOY_CHECKLIST.md)

### 5-4. 관리자 웹 테스트 (앱 불필요)

1. `https://ppamong.com/admin/signup` — 어드민 가입
2. 슈퍼어드민이 `/admin/staff` 등에서 **승인**
3. `/admin/login` 로그인 → 회원·경기·매니저 관리 메뉴 확인

### 5-5. 브라우저로 사용자·매ni저 UI 사전 확인 (앱 빌드 전)

| 역할 | URL |
|------|-----|
| 사용자 | `https://ppamong.com/login` |
| 매ni저 | `https://ppamong.com/manager/login` |

서버·도메인이 정상이면 앱 없이도 화면·API 연동을 먼저 검증할 수 있습니다.

---

## 6. 사용자 앱 빌드 (Windows)

### 사전 조건

- `https://ppamong.com` Deploy 완료
- Node.js, Android Studio (Android) / Mac + Xcode (iOS)

### Android (`C:\PPADUN9\android`)

1. (선택) `web`에서 웹 빌드 후 Capacitor sync — **원격 URL 모드**면 필수는 아님
2. Android Studio → **`C:\PPADUN9\android`** 폴더 열기
3. `capacitor.config.json`의 `server.url`이 `https://ppamong.com` 인지 확인
4. **Build → Generate Signed Bundle / APK**

### iOS (`C:\PPADUN9\ios`)

1. Xcode → **`C:\PPADUN9\ios\App`** 열기
2. Signing & Capabilities 설정
3. **Product → Archive** → App Store Connect

### 사용자 앱 Capacitor 설정 (참고)

- 설정 파일: `web/capacitor.config.ts`
- `server.url`: `https://ppamong.com/login`

---

## 7. 매ni저(운영자) 앱 빌드 (Windows)

매ni저는 **별도 App ID**로 사용자 앱과 동시 설치 가능.

| 구분 | 사용자 앱 | 매ni저 앱 |
|------|-----------|-----------|
| App ID | `com.ppamong.app` | `com.ppamong.manager` |
| Vite | `vite.config.ts` | `vite.manager.config.ts` |
| Capacitor | `capacitor.config.ts` | `capacitor.config.manager.ts` |
| 빌드 출력 | `dist/public` | `dist-manager/public` |
| Android 폴더 | `C:\PPADUN9\android` | `web\android-manager` |
| 시작 URL | `/login` | `/manager` |

### Android 매ni저 — 요약

```powershell
cd C:\PPADUN9\web

# 1. 매ni저 웹 빌드
npx vite build --config vite.manager.config.ts

# 2. Android Studio에서 web\android-manager 열기 후 빌드
```

상세: [MANAGER_ANDROID_BUILD.md](./MANAGER_ANDROID_BUILD.md)

### iOS 매ni저

- Xcode → **`web\ios-manager-standalone`** 열기 후 Archive

---

## 8. android / ios를 GitHub에 넣을지?

### 현재

- GitHub: **`web`만**
- 사용자 `android`/`ios`: **`C:\PPADUN9\` 루트, 로컬만**

### 권장

| 옵션 | 장점 | 단점 |
|------|------|------|
| **A. 지금처럼 web만 Git** | 단순, Replit와 일치 | 사용자 네이티브 프로젝트 백업·협업 어려움 |
| **B. web repo에 android/ios 추가** | 한 repo에서 Capacitor sync·버전 관리 | repo 크기 증가, CI 복잡 |
| **C. android/ios 별도 private repo** | 앱 팀 분리 가능 | repo 3개 관리 |

**실무 추천:**  
- 서버·UI는 **`web` + Replit** 유지  
- 사용자 `C:\PPADUN9\android`, `ios`는 **private repo 또는 백업** 추가 검토  
- 매ni저 `android-manager`, `ios-manager-standalone`은 이미 **`web` repo 안**에 있음

원격 URL 모드에서는 **네이티브 변경이 적으므로** `web`만 자주 push해도 운영 가능.

---

## 9. API·인증 구분 (참고)

| 역할 | API prefix 예 | 로그인 경로 |
|------|---------------|-------------|
| 사용자 | `/api/users/*`, `/api/signup` | `/login` |
| 매ni저 | `/api/manager/*` | `/manager/login` |
| 관리자 | `/api/admin/*` | `/admin/login` |

---

## 10. 관련 문서

- [PPAMONG_DEPLOY_CHECKLIST.md](./PPAMONG_DEPLOY_CHECKLIST.md) — Replit, Atlas, OAuth, DNS
- [MANAGER_ANDROID_BUILD.md](./MANAGER_ANDROID_BUILD.md) — 매ni저 Android 빌드 상세
- [api-spec.md](./api-spec.md) — API 명세

---

## 11. 프로젝트 정의 (팀 공유용)

**ppamong**은 **3클라이언트 1서버** 구조입니다.

- **백엔드:** `web` (Express + MongoDB + Redis), Replit `ppamong.com`
- **사용자:** Android/iOS 앱 → WebView → `ppamong.com/login` …
- **운영자(매ni저):** 별도 Android/iOS 앱 → `ppamong.com/manager` …
- **관리자:** 웹 브라우저만 → `ppamong.com/admin` …

앱 2종 + 관리자 웹은 **같은 서버·같은 DB**를 사용하며, 관리자 웹에서 매ni저 승인·경기 배정·회원·수익을 관리합니다.
