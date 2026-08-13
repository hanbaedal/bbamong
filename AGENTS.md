# AGENTS.md

## Cursor Cloud specific instructions

This repo (`bbamong` / PPAMONG, ppamong.com) is a single full-stack app: one Express + `tsx` server on port `5000` that serves the API, a `/ws/match` WebSocket, and all React front-ends. The front-end shown depends on the URL path (see `client/src/main.tsx`): `/admin/*` (admin), `/manager/*` (manager), `/login` + `/home/*` (end-user), and mall paths. Root `/` redirects to `/admin/`.

Standard commands live in `package.json` scripts and `README.md`. Dev run is `npm run dev` (→ http://localhost:5000). Key non-obvious notes for this environment:

### Services / startup
- **MongoDB is the runtime DB** (Mongoose), not PostgreSQL. `replit.md` / `PPADUN9_소스분석.md` are out of date on this; the Drizzle/Postgres config is legacy migration-only. The server throws and refuses to boot without `MONGODB_URI`.
- A **local MongoDB** (`mongod`) is used for dev, listening on `127.0.0.1:27017`. The app does **NOT** auto-start MongoDB, so start it before `npm run dev` if it isn't running: `mongod --dbpath /data/db --bind_ip 127.0.0.1 --port 27017 --fork --logpath /var/log/mongodb/mongod.log` (check first with `mongosh --quiet --eval 'db.runCommand({ping:1})'`).
- **Redis is required and auto-started by the app** (`startRedis()` in `server/index.ts` spawns `redis-server` if `redis-cli ping` fails), so no manual Redis start is normally needed as long as the `redis-server` binary is installed.
- Config lives in `.env` (gitignored, persists in the VM snapshot). It points at the local MongoDB/Redis and sets `JWT_SECRET` / `JWT_REFRESH_SECRET`. It also sets `PHONE_VERIFICATION_REQUIRED=false` so SOLAPI SMS is not needed (registration codes fall back to in-app display). Recreate from `.env.example` if missing.

### Auth / testing
- On boot the server auto-seeds a **superadmin**: username `ppamong`, password `ppamong.0323` (see `server/bootstrapSuperAdmin.ts`). Log in at `/admin/login`. This is the quickest way to exercise the full stack (Express + MongoDB + Redis + JWT) end-to-end.

### Lint / typecheck / test / build
- There is **no ESLint config and no test framework** in this repo. The only "lint" is `npm run check` (`tsc`), which currently reports **many pre-existing type errors** and is **not a clean gate** — dev runs through `tsx` (no typecheck) and is unaffected.
- Production build is `npm run build` (Vite + esbuild); dev should use `npm run dev`, not the build.
- External integrations (Kakao/Google/Apple OAuth, SOLAPI SMS, API-SPORTS live scores, Cloudflare R2 / GCS storage, AdMob, legacy Postgres sync) are all optional and disabled/stubbed when their env vars are unset.

### Delivery preference (owner)
- When a change set is done: **push to GitHub, open/update the PR, mark ready, and squash-merge to `main`** in the same turn unless the user asks to keep it draft or hold merge. Do not leave finished work as unmerged open PRs by default.

### Prediction wait / black screen
- `/api/matches` 등 React Query는 **429·세션 오류 시 null로 캐시를 덮지 않는다** (throw → 이전 스냅샷 유지). null을 `[]`로 취급하면 가짜 `no_match` 검은 화면·`matchesData.some` 크래시가 난다.
- 예측 화면 keepAlive는 **4분** 간격, WS 연결 전 access는 **만료 2분 전 refresh**, close `4005`는 **forceRefresh 후** 재연결.
- 라이브 대기 중 HTTP 폴링은 WS 보조로 **완화**(목록·스코어보드·phase ~8–10s). side-bet는 세션 교체/만료 메시지 시 interval 중지.

### Prediction flow edge guards
- `wait_result` 중 `round_next`는 결과 생략(`skippedResult`)이 아니면 보류한다. 투수교체 환불 시 서버가 `skippedResult: true`를 보낸다.
- `betSnapshotRef`로 `activeBet`이 비어도 `round_result` 연출이 가능하고, 없으면 `/check`로 복구한다.
- 유저 WS는 `prediction_cancelled`를 처리한다. 결과/대기 중 전면광고는 덮지 않는다(보류 후 재생).
- **게임 배너 광고 없음**: 예측 게임에서 배너를 쓰지 않는다. **공수교대·투수교체** 시 전면(+보상) 광고만 `scheduleAdStart`(약 5초 후)로 재생한다.
- **광고 시작/중지**: 운영자 **투수교체·공수교대** = 광고 시작, **예측 시작**(또는 하단 광고 종료) = 광고 중지(`ad_stopped`). 별도「광고 시작」버튼 없음.
- **사용자 광고 UX**: 5초 후 X로 끄기 가능(보상 없음). **운영자가 광고를 중지할 때까지** 보고 있으면 500P. 15초 자동 보상 없음. 5초 만에 끄면 보상 없음.

### Admin schedule team logos
- Admin 경기관리 리스트는 API-SPORTS `teams.*.logo` URL을 원형으로 표시한다 (실패 시 약칭 이니셜 폴백). 관리자 전용 UI용이며, 사용자 앱에 공식 엠블럼을 확대 배포하기 전에는 별도 권리 검토가 필요하다.

### Live scoreboard (API vs operator)
- During `matchStatus === "ongoing"` and `controlMode === "auto"`, API-SPORTS polls **do overwrite** `liveScoreboard` scores/inning tables. `controlMode === "manual"` (운영자/관리자 점수 보정) keeps operator scores until they turn auto back on.
- Display for “N회 초/말” prefers operator `gameInning` / `inningHalf` over API (`shared/matchPhaseDisplay.ts`).
- Operators/admins can PATCH scores (`/api/manager/matches/:id/scoreboard`, `/api/admin/matches/:id/scoreboard`) which sets `controlMode: "manual"`. `lockManual: false` (또는 관리자 「수동」 끄기) returns to auto.
- **`matchStatus` vs 예측 오픈**: 「예측 시작」은 `predictionEnabled`/`sideBetsLocked`만 켠다. `matchStatus: ongoing`은 API live·이닝 등 **실황 근거**로만 올린다. API `NS`(시작 전)이면 `scheduled`로 되돌린다(ongoing 고착 방지). UI「경기중」도 API 시작 전을 우선한다.
