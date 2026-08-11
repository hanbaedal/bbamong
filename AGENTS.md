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

### Prediction flow edge guards
- `wait_result` 중 `round_next`는 결과 생략(`skippedResult`)이 아니면 보류한다. 투수교체 환불 시 서버가 `skippedResult: true`를 보낸다.
- `betSnapshotRef`로 `activeBet`이 비어도 `round_result` 연출이 가능하고, 없으면 `/check`로 복구한다.
- 유저 WS는 `prediction_cancelled`를 처리한다. 결과/대기 중 전면광고는 덮지 않는다(보류 후 재생).
- **게임 배너 광고 없음**: 예측 게임에서 배너를 쓰지 않는다. **공수교대·투수교체** 시 전면(+보상) 광고만 `scheduleAdStart`(약 5초 후)로 재생한다.

### Admin schedule team logos
- Admin 경기관리 리스트는 API-SPORTS `teams.*.logo` URL을 원형으로 표시한다 (실패 시 약칭 이니셜 폴백). 관리자 전용 UI용이며, 사용자 앱에 공식 엠블럼을 확대 배포하기 전에는 별도 권리 검토가 필요하다.

### Live scoreboard (API vs operator)
- During `matchStatus === "ongoing"`, API-SPORTS polls **do not overwrite** `liveScoreboard` scores/inning tables (status/team names still refresh). Final FT while `controlMode === "auto"` applies the API final board; `manual` keeps operator/admin corrections.
- Display for “N회 초/말” prefers operator `gameInning` / `inningHalf` over API (`shared/matchPhaseDisplay.ts`).
- Operators/admins can PATCH scores (`/api/manager/matches/:id/scoreboard`, `/api/admin/matches/:id/scoreboard`) which sets `controlMode: "manual"`. Toggle admin “수동” off to return to auto (end sync can apply again).
