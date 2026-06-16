# ppamong.com 배포 체크리스트

코드는 GitHub `hanbaedal/bbamong` main에 있습니다. 아래는 **Atlas / Replit / DNS / OAuth**에서 직접 진행할 작업입니다.

---

## 1. MongoDB Atlas 설정

### 1-1. 클러스터

1. https://cloud.mongodb.com 로그인
2. 프로젝트 → **Build a Cluster** (또는 기존 클러스터 사용)
3. **M0 Free** 또는 M10+ 선택 (트랜잭션 사용 → Replica Set 필요, Atlas M0+ OK)

### 1-2. Database Access (DB 사용자)

1. **Database Access** → **Add New Database User**
2. Authentication: **Password**
3. Username 예: `ppamong_app`
4. Password: 강력한 비밀번호 생성 (특수문자 `@`, `#` 등은 URI 인코딩 필요)
5. Privileges: **Read and write to any database** (또는 `ppamong` DB만)

### 1-3. Network Access (IP 허용)

Replit은 고정 IP가 없으므로:

1. **Network Access** → **Add IP Address**
2. **Allow Access from Anywhere** → `0.0.0.0/0`  
   (운영 안정화 후 Atlas Private Endpoint 등으로 좁히는 것을 권장)

### 1-4. 연결 문자열 만들기

1. **Database** → **Connect** → **Drivers**
2. Driver: **Node.js**, Version: 5.5 or later
3. 표시되는 URI 형식:

```
mongodb+srv://ppamong_app:<PASSWORD>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

4. `<PASSWORD>`를 실제 비밀번호로 교체  
   - `@` → `%40`, `#` → `%23` 등 [URL 인코딩](https://www.urlencoder.org/) 적용
5. DB 이름은 코드에서 `MONGODB_DB_NAME`(기본 `ppamong`)으로 지정하므로 URI 끝에 `/ppamong`을 붙여도 됩니다:

```
mongodb+srv://ppamong_app:비밀번호@cluster0.xxxxx.mongodb.net/ppamong?retryWrites=true&w=majority
```

### 1-5. 연결 테스트 (로컬)

`.env` 파일:

```env
MONGODB_URI=mongodb+srv://...
MONGODB_DB_NAME=ppamong
JWT_SECRET=랜덤-32자-이상
JWT_REFRESH_SECRET=다른-랜덤-32자-이상
```

```bash
npm run dev
```

콘솔에 `[MongoDB] Connected to Atlas (ppamong)` 가 보이면 성공.

---

## 2. Replit ↔ GitHub 동기화

1. https://replit.com/@hanbaedal/First-Visit (또는 bbamong 연결 Repl) 열기
2. Shell:

```bash
git pull origin main
```

3. `.replit`의 `[userenv.shared]` → `BASE_URL = "https://ppamong.com"` 확인

---

## 3. Replit Secrets (Tools → Secrets)

아래를 **Key = Value** 형태로 모두 등록합니다.

### 필수 (서버 기동)

| Secret | 예시 / 설명 |
|--------|-------------|
| `MONGODB_URI` | `mongodb+srv://ppamong_app:...@cluster....mongodb.net/ppamong?retryWrites=true&w=majority` |
| `MONGODB_DB_NAME` | `ppamong` (생략 시 코드 기본값 사용) |
| `JWT_SECRET` | `openssl rand -base64 32` 로 생성 |
| `JWT_REFRESH_SECRET` | JWT_SECRET과 **다른** 값 |
| `BASE_URL` | `https://ppamong.com` (`.replit` shared에도 있으나 Secrets에 두면 Deploy에서 확실) |
| `NODE_ENV` | `production` (Deploy 시) |

### Redis (세션·소셜 pending 코드)

Replit Repl에 내장 Redis(`127.0.0.1:6379`)를 쓰는 경우 **추가 Secrets 불필요** (기본값 사용).

외부 Redis(Upstash 등) 사용 시:

| Secret | 설명 |
|--------|------|
| `REDIS_HOST` | 호스트 |
| `REDIS_PORT` | `6379` |
| `REDIS_PASSWORD` | 비밀번호 (없으면 생략) |

> 코드는 `REDIS_URL`이 아니라 `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` 를 사용합니다.

### OAuth (소셜 로그인)

| Secret | 용도 |
|--------|------|
| `KAKAO_CLIENT_ID` | 카카오 REST API |
| `KAKAO_CLIENT_SECRET` | 카카오 |
| `GOOGLE_CLIENT_ID` | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Google |
| `APPLE_CLIENT_ID` | Apple Sign In |
| `APPLE_TEAM_ID` | Apple Developer Team ID |
| `APPLE_KEY_ID` | Apple Key ID |
| `APPLE_PRIVATE_KEY` | `.p8` 키 내용 (줄바꿈 `\n` 또는 실제 multiline) |

### SMS (SOLAPI, 선택)

| Secret | 설명 |
|--------|------|
| `SOLAPI_API_KEY` | SOLAPI |
| `SOLAPI_API_SECRET` | SOLAPI |
| `SOLAPI_SENDER_PHONE` | 발신번호 (`.replit` shared에 `01023686311` 있음) |

### AdMob (관리자, 선택)

| Secret |
|--------|
| `ADMOB_REFRESH_TOKEN`, `ADMOB_CLIENT_ID`, `ADMOB_CLIENT_SECRET`, `ADMOB_PUBLISHER_ID` |

### 더 이상 사용하지 않음

- ~~`DATABASE_URL`~~ → PostgreSQL/Drizzle 제거됨. **`MONGODB_URI` 사용**

---

## 4. Replit Deploy + 커스텀 도메인

1. **Deploy** → **Autoscale**
2. Build: `npm run build` / Run: `npm run start` (`.replit` [deployment]에 설정됨)
3. **Deploy** 실행 후 Logs에서 MongoDB/Redis 연결 확인
4. **Custom domains** → `ppamong.com`, `www.ppamong.com` 추가
5. Replit이 안내하는 DNS 레코드를 도메인 업체에 등록

확인 URL: https://ppamong.com/login

---

## 5. DNS (도메인 업체)

Replit Custom domains 화면의 값을 그대로 등록 (예시):

| 타입 | 호스트 | 값 |
|------|--------|-----|
| CNAME | `@` | (Replit 제공 주소) |
| CNAME | `www` | (Replit 제공 주소) |

---

## 6. OAuth Redirect URI

각 콘솔에 **정확히** 아래 URI 등록:

| 제공자 | Redirect URI |
|--------|----------------|
| Kakao | `https://ppamong.com/api/auth/kakao/callback` |
| Google | `https://ppamong.com/api/auth/google/callback` |
| Apple | `https://ppamong.com/api/auth/callback/apple` |

웹 도메인 / JavaScript origin: `https://ppamong.com`

---

## 7. 클라이언트 빌드 (모바일)

```powershell
cd c:\PPADUN9\web
npm run build
```

- Android: `web\android`
- iOS: (별도 프로젝트 — `web\android`와 동일 App ID `com.ppamong.app`)
- Capacitor 서버 URL: `https://ppamong.com`

---

## 8. 문제 해결

| 증상 | 확인 |
|------|------|
| `MONGODB_URI is required` | Replit Secrets에 `MONGODB_URI` 추가 후 Repl 재시작 |
| MongoDB authentication failed | Atlas DB 사용자 비밀번호·URI 인코딩 확인 |
| MongoServerSelectionError | Atlas Network Access에 `0.0.0.0/0` 추가 |
| Redis 연결 실패 | Repl에서 Redis 프로세스 실행 여부 또는 외부 Redis Secrets |
| JWT 오류 | `JWT_SECRET`, `JWT_REFRESH_SECRET` 둘 다 설정 |

---

## 빠른 Secrets 붙여넣기 템플릿

Replit Secrets에 하나씩 추가 (값은 본인 것으로 교체):

```
MONGODB_URI=mongodb+srv://USER:PASS@cluster.mongodb.net/ppamong?retryWrites=true&w=majority
MONGODB_DB_NAME=ppamong
JWT_SECRET=
JWT_REFRESH_SECRET=
BASE_URL=https://ppamong.com
NODE_ENV=production
KAKAO_CLIENT_ID=
KAKAO_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```
