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
- **Walkthrough evidence**: Do **not** create demo/screen-recording videos. Prefer screenshots, curl/API logs, and terminal output as proof. UI changes still need visual verification (screenshots), but video artifacts are not required unless the user explicitly asks.

### Lint / typecheck / test / build
- There is **no ESLint config and no test framework** in this repo. The only "lint" is `npm run check` (`tsc`), which currently reports **many pre-existing type errors** and is **not a clean gate** — dev runs through `tsx` (no typecheck) and is unaffected.
- Production build is `npm run build` (Vite + esbuild); dev should use `npm run dev`, not the build.
- External integrations (Kakao/Google/Apple OAuth, SOLAPI SMS, Cloudflare R2 / GCS storage, AdMob, legacy Postgres sync) are all optional and disabled/stubbed when their env vars are unset. **KBO 일정·실황·상대전적·로고는 다음 스포츠(+네이버)만 사용한다. API-SPORTS 키는 필요 없다.**

### Delivery preference (owner)
- When a change set is done: **push to GitHub, open/update the PR, mark ready, and squash-merge to `main`** in the same turn unless the user asks to keep it draft or hold merge. Do not leave finished work as unmerged open PRs by default.
- **Replit Deploy**: `main` merge alone does **not** update `ppamong.com`. After merge, Replit → **Deploy → Redeploy** (or `git pull` on the Repl then Redeploy). Confirm with asset `Last-Modified` newer than the merge time.

### Prediction wait / black screen
- 유저 예측 화면 단계(`wait`/`open`/`closed`/`result`)는 서버 `at_bat_phase`의 `uiStage`가 권위다. 클라는 이를 그린다 (`shared/predictionUiStage.ts`). `prediction_started`/`stopped`는 음성·광고 부수효과 + 폴백.
- `/api/matches` 등 React Query는 **429·세션 오류 시 null로 캐시를 덮지 않는다** (throw → 이전 스냅샷 유지). null을 `[]`로 취급하면 가짜 `no_match` 검은 화면·`matchesData.some` 크래시가 난다.
- 예측 화면 keepAlive는 **4분** 간격, WS 연결 전 access는 **만료 2분 전 refresh**, close `4005`는 **forceRefresh 후** 재연결.
- **전화·문자·SNS 복귀**: 웹도 `visibilitychange`(hidden→visible)·bfcache `pageshow`로 WS를 강제 재연결하고, `/check`·경기 폴링으로 타석/결과를 맞춘다. 네이티브는 `appStateChange`도 같다. 자리비움 중 해당 타석 예측은 불가(서버 경기는 계속). 복귀 시 이미 본 결과는 ack로 중복 연출하지 않는다. 환불된 포인트는 `refetchUser`로 맞춘다.
- 라이브 대기 중 HTTP 폴링은 WS 보조로 **완화**(목록·스코어보드·phase ~8–10s). side-bet는 세션 교체/만료 메시지 시 interval 중지.

### Prediction flow edge guards
- `wait_result` 중 `round_next`는 결과 생략(`skippedResult`)이 아니면 보류한다. 투수교체 환불 시 서버가 `skippedResult: true`를 보낸다. 복귀 `/check`는 **현재 라운드에 예측이 없고 라운드가 바뀌었으면** 결과대기를 해제한다(같은 라운드 제출 레이스는 유지). 자리비움 중 결과는 주루를 생략하고 짧은 배너만 쓰며, 다음 타석이 이미 열려 있으면 복귀 즉시 예측 창으로 간다.
- `betSnapshotRef`로 `activeBet`이 비어도 `round_result` 연출이 가능하고, 없으면 `/check`로 복구한다.
- 유저 WS는 `prediction_cancelled`를 처리한다. 결과/대기 중 리워드 광고는 덮지 않는다(보류 후 재생).
- **게임 배너 광고 없음**: 예측 게임에서 배너를 쓰지 않는다. **공수교대·투수교체** 시 **리워드 동영상**(네이티브 AdMob) 또는 웹 오버레이 폴백. 광고 세션 **80초** 후 자동 종료·보상. 5초 후 왼쪽 위 ×로 끌 수 있음(보상 없음). 다음 타석 예측은 운영자 「예측 시작」만.
- **모바일 음성**: 예측/운영자 안내는 MP3(`client/public/audio/voice-*.mp3`). 스마트폰은 **화면을 한 번 탭**해야 재생된다. 사용자: 타석 열림/닫힘·성공/실패·공수/투수/대타·당일 상태·종료. 운영자: 3아웃·결과 확정·예측 시작·경기 종료(짧은 조작 안내). 재생성: `python3 scripts/generate-game-voice-clips.py`.
- **광고 시작/중지**: 운영자 **투수교체·공수교대** = 광고 시작, **예측 시작** = 광고 중지(`ad_stopped`). `ad_stopped.reason`: `prediction_start`(보상 없음), `operator_stop`(500P), `round_advance`(광고만 닫기).
- **사용자 광고 UX**: 네이티브는 광고 화면에 **남은 초**가 보이고 **80초 후 예측 화면으로 자동 전환**한다. 리워드 동영상은 같은 80초 안에 재생하고, 끝나면 전체화면을 닫는다. 웹·앱 오버레이는 5초 후 왼쪽 위 X(보상 없음). 같은 `adStartedAt` 세션 X 후 재연결·`ad_status`로 오버레이 재표시 안 함. 광고가 끝나도 서버는 예측을 자동 재개하지 않는다(운영자 「예측 시작」).
- **친구·동호회 방**: 방 전용 경기가 아니다. 오늘 공개 예측에 함께 참여하고 멤버 순위만 참고한다.

### Admin schedule team logos
- Admin 경기관리 리스트는 다음 스포츠 `team.imageUrl`을 원형으로 표시한다 (실패 시 약칭 이니셜 폴백). 관리자 전용 UI용이며, 사용자 앱에 공식 엠블럼을 확대 배포하기 전에는 별도 권리 검토가 필요하다.

### Live scoreboard (Daum vs Naver vs operator)
- KBO 일정 자동 등록·실시간 **점수**는 **다음 스포츠**만 쓴다 (득점·안타·실책·볼넷·이닝표·팀 로고). **주자·볼-스트라이크·아웃·타자·구종·상대전적**은 **네이버**(문자중계 `relay` / preview `seasonVsResult`). 같은 필드(점수 vs 주자)를 두 소스에서 섞거나 보정하지 않는다. **API-SPORTS는 사용하지 않는다.**
- 선발명단은 관리자 「오늘의 선발명단」(다음으로 경기 찾고, 네이버로 타순) 또는 운영자 수동 타순. API-SPORTS 라인업 폴백 없음.
- 예측 화면 좌상단 공지 배지 자리에는 **경기 진행 위젯**(이닝·점수는 다음, 구장명, 다이아몬드·B-S·OUT·타자·구종은 네이버)을 둔다. 배경은 투명. 가운데 헤더는 `제 N경기`만. 공지사항은 설정 메뉴에서만 본다. 네이버 타석이 없으면 위젯은 점수만 보여주고 `0-0 0 OUT`을 가짜로 채우지 않는다.
- 왼쪽 위젯 팀명 클릭 → 화면 가운데 시즌 성적 모달 (순위·승무패·승률·타율·평균자책·승차, 닫기). 구장은 왼쪽 팀명 하단(클릭 시 경기장 선택). 상대전적은 우측 스코어보드 바로 아래. 운영자 타순 입력은 팀명 옆 「타순」 버튼.
- 예측 개인기록은 스코어보드·상대전적 아래 4행 2열(타율·홈런 / 안타·타점 / 득점·도루 / 출루율·OPS).
- **표시·자동 동기화**: “N회 초/말”·팀 옆 점수는 **실황 스코어보드를 우선**한다 (`shared/matchPhaseDisplay.ts`, `shared/liveScoreTotals.ts`). 실황 폴링 시 운영자 `gameInning`/`inningHalf`/`outsInHalf`/`batterIndexInHalf`도 실황에 맞춘다. **타석 진행은 운영자 버튼이 권위**다: 예측 시작·결과 확정·다음타자·공수교대·투수교체·대타는 수동. **자동 예측 중지**는 `schedulePredictionAutoStop` 한 루틴만(시작 후 8초). 공수교대·투수교체 **광고 80초**. 3아웃·공수교대 멘트는 **네이버 실황 outs≥3**일 때만(초/말 깜빡임·결과 +1만으로 금지). 실황은 제안만 (`auto_result_suggested` / `auto_action_suggested`). `liveAutoOperator.ts`는 실황 동기화·힌트·8초 중지. 예전 `liveAutoEnabled=false` 잔여값은 폴링 시 자동 복구. **예측 시작 시 광고 자동 중지**. 경기종료 10초 연출 후 로그아웃. 운영자 공수교대는 `liveScoreboard` 이닝을 덮어쓰지 않는다.
- During `matchStatus === "ongoing"` and `controlMode === "auto"`, live polls **do overwrite** `liveScoreboard` scores/inning tables (Daum). `controlMode === "manual"` (운영자/관리자 점수 보정) keeps operator scores until they turn auto back on. 주자·볼카운트는 manual이어도 네이버 실황을 갱신한다. 네이버 폴링이 비면 직전 `situation`을 유지한다.
- Operators/admins can PATCH scores (`/api/manager/matches/:id/scoreboard`, `/api/admin/matches/:id/scoreboard`) which sets `controlMode: "manual"`. `lockManual: false` (또는 관리자 「수동」 끄기) returns to auto.
- **`matchStatus` vs 예측 오픈**: 「예측 시작」은 `predictionEnabled`/`sideBetsLocked`만 켠다. `matchStatus: ongoing`은 실황(다음 스포츠) 근거로만 올린다. 시작 전(`NS`·다음 `BEFORE`/`READY`)이면 `scheduled`로 되돌린다(ongoing 고착 방지). UI「경기중」도 시작 전을 우선한다. 다음 `BEFORE`는 진행이 아니다.
- 관리자 `/admin/operators/list`의 **실황 ON/OFF**는 다음·네이버 실황 + 회원 게임 연동이다. API-SPORTS가 아니다. 기본은 1경기만 ON.
