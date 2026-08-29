/**
 * shared 카탈로그에서 docs/*.md 상세 설명서를 생성합니다.
 * 실행: npx tsx scripts/write-system-manuals-md.ts
 */
import fs from "fs";
import path from "path";
import {
  LIVE_SCOREBOARD_FIELDS,
  MONGO_CATALOG_UPDATED,
  MONGO_CLUSTER,
  MONGO_COLLECTIONS,
} from "../shared/mongoCatalog";
import {
  FLOW_CROSS_LINKS,
  FLOW_SWIMLANES,
  MANUAL_DETAIL_UPDATED,
  OPERATOR_RULES,
  OPERATOR_TECH_STACK,
  OPERATOR_USER_STEPS,
  USER_TECH_STACK,
  USER_USER_EXTRA,
  USER_USER_STEPS,
} from "../shared/systemManualsDetail";
import {
  ADMIN_DAILY_CHECKLIST,
  ADMIN_MENU_MAP,
  AD_RULE_ROWS,
  AT_BAT_GUARDS,
  AT_BAT_MACHINE_STEPS,
  BET_AMOUNT_FACT,
  LIVE_SOURCE_TABLE,
  MALL_POLICY_BULLETS,
  MATCH_STATUS_RULES,
  OPERATOR_EXCEPTION_STEPS,
  PREDICTION_ODDS_TABLE,
  PREDICTION_SCREEN_FLOW_NOTES,
  TIMING_FACTS,
} from "../shared/systemOpsHandbook";

const DOCS = path.resolve(process.cwd(), "docs");
const IMG = (file: string) => `../assets/game/${file}`;

function table(headers: string[], rows: string[][]): string {
  const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, "<br>");
  const head = `| ${headers.map(esc).join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${r.map(esc).join(" | ")} |`).join("\n");
  return `${head}\n${sep}\n${body}`;
}

function write(fileName: string, body: string) {
  const full = path.join(DOCS, fileName);
  fs.writeFileSync(full, body.trim() + "\n", "utf8");
  console.log("wrote", full);
}

function flowMd(): string {
  const lanes = FLOW_SWIMLANES.map(
    (lane) =>
      `### ${lane.title}\n\n${lane.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`,
  ).join("\n\n");

  return `# 빠몽이 전체 흐름도 (관리자 · 운영자 · 사용자 · 쇼핑몰)

기준일: ${MANUAL_DETAIL_UPDATED}  
대상: PPAMONG (ppamong.com) Express + MongoDB \`${MONGO_CLUSTER.database}\` + Redis + WebSocket \`/ws/match\`

이 문서는 관리자 화면 \`/admin/ops/system-manuals\` 1장과 같은 소스입니다.

## 한눈에

\`\`\`
관리자  경기 등록 · 선발명단  →  실황 ON (기본 1경기)  →  모니터링 / 수동 점수
              │
              ▼
운영자  당일 비밀번호 입장  →  하이브리드 타석  →  예측 8초 → 결과 확정
              │                         └→ 공수·투수 시 광고 80초
              ▼
사용자  인트로·홈  →  실황 ON 경기 선택  →  대기 시네마틱 → 3D 선택 → 주루 → 정산
              │
              ▼
쇼핑몰  정회원 현금 주문  →  관리자 재고 · 발송   (게임 포인트로 결제하지 않음)

Express :5000  ·  MongoDB ppamong  ·  Redis 세션  ·  /ws/match
점수·이닝·로고 = 다음 스포츠    주자·B-S·OUT·타자 = 네이버
\`\`\`

## 역할별 단계

${lanes}

## 교차 규칙

${FLOW_CROSS_LINKS.map((l) => `- ${l}`).join("\n")}

## 관리자 일일 체크

${ADMIN_DAILY_CHECKLIST.map((l, i) => `${i + 1}. ${l}`).join("\n")}

## 관리자 메뉴

${ADMIN_MENU_MAP.map((b) => `### ${b.section}\n\n${b.items.map((i) => `- ${i}`).join("\n")}`).join("\n\n")}

## 쇼핑몰

${MALL_POLICY_BULLETS.map((l) => `- ${l}`).join("\n")}

## 타이밍

${table(
  ["항목", "기본값"],
  TIMING_FACTS.map((r) => [r.label, r.value]),
)}

배팅: ${BET_AMOUNT_FACT}
`;
}

function operatorMd(): string {
  return `# 빠몽이 운영자 설명서 (사용 + 기술)

기준일: ${MANUAL_DETAIL_UPDATED}  
대상: \`/manager\` 운영자 웹 · Android WebView

이 문서는 관리자 화면 \`/admin/ops/system-manuals\` 2장과 같은 소스입니다.

## 사용 설명서

하이브리드만 사용합니다. 실황이 타석을 돌리고, 운영자 버튼이 먼저면 그게 우선입니다. 토글은 없습니다.

${OPERATOR_USER_STEPS.map((s) => `### ${s.title}\n\n${s.body}`).join("\n\n")}

### 예외 루프 한 줄

${OPERATOR_EXCEPTION_STEPS.map((l) => `- ${l}`).join("\n")}

### 규칙

${OPERATOR_RULES.map((l) => `- ${l}`).join("\n")}

### 타석 상태머신

${AT_BAT_MACHINE_STEPS.map((s) => `- **${s.label}** — ${s.value}`).join("\n")}

${AT_BAT_GUARDS.map((l) => `- ${l}`).join("\n")}

## 회원 화면이 따라가는 장면

운영자가 예측을 열면 3D 구장, 닫으면 투수 시네마틱, 적중하면 주루 실사입니다.

![예측 선택 3D 구장](${IMG("game-stadium-field.jpg")})

![결과 대기 투수(말)](${IMG("scene-pitch-home.jpg")})

![주루 실사](${IMG("scene-running.jpg")})

## 광고

${table(AD_RULE_ROWS.headers, AD_RULE_ROWS.rows)}

## 기술 설명서

${table(
  ["항목", "내용"],
  OPERATOR_TECH_STACK.map((r) => [r.label, r.value]),
)}

### 실황 소스

${table(LIVE_SOURCE_TABLE.headers, LIVE_SOURCE_TABLE.rows)}

${MATCH_STATUS_RULES.map((l) => `- ${l}`).join("\n")}

### API · WS 메모

- 예측 시작/중지, 결과 전송, 다음타자, 공수교대, 투수교체, PATCH \`/api/manager/matches/:id/scoreboard\`
- WS \`/ws/match\`: \`at_bat_phase\`, \`prediction_started\` / \`stopped\`, \`round_result\`, \`round_next\`, \`ad_started\` / \`ad_stopped\`, \`match_ended\`
- 회원 \`uiStage\` 권위는 서버 \`at_bat_phase\`
- 3아웃 카운트는 \`Match.outsInHalf\`. 「3아웃 공수교대」음성은 네이버 같은 초/말 3아웃만. 실황 1·2면 보류 배너. 실황이 이미 다음 초/말이면 공수교대=맞춤+광고. 폴링이 운영자 초/말·아웃을 덮지 않음
- 실황 ON은 \`AdminUser.apiSyncEnabled\` (Match 필드가 아님)
`;
}

function userMd(): string {
  return `# 빠몽이 사용자 설명서 (사용 + 기술)

기준일: ${MANUAL_DETAIL_UPDATED}  
대상: \`/login\` · \`/home\` · \`/prediction\`

이 문서는 관리자 화면 \`/admin/ops/system-manuals\` 3장과 같은 소스입니다.

## 사용 설명서 — 단계

홈 「예측게임 하러가기」 → 실황 ON 경기 선택 → 사이드벳(선택) → 타석 7단계.

### 1. 경기전

![쿠어스 전경](${IMG("scene-before.jpg")})

${USER_USER_STEPS.find((s) => s.order === 1)?.whatHappens ?? ""}

### 2. 대기 (초=청 / 말=흰)

![대기 말](${IMG("scene-wait-home.jpg")})

![대기 초](${IMG("scene-wait-away.jpg")})

${USER_USER_STEPS.find((s) => s.order === 2)?.whatHappens ?? ""}

### 3. 예측 선택

![3D 구장](${IMG("game-stadium-field.jpg")})

${USER_USER_STEPS.find((s) => s.order === 3)?.whatHappens ?? ""}

### 4–5. 결과 대기 · 글씨

![투수 말](${IMG("scene-pitch-home.jpg")})

![투수 초](${IMG("scene-pitch-away.jpg")})

4: ${USER_USER_STEPS.find((s) => s.order === 4)?.whatHappens ?? ""}  
5: ${USER_USER_STEPS.find((s) => s.order === 5)?.whatHappens ?? ""}

### 6. 주루 (적중만)

![주루](${IMG("scene-running.jpg")})

${USER_USER_STEPS.find((s) => s.order === 6)?.whatHappens ?? ""}

### 7. 다음 타석

${USER_USER_STEPS.find((s) => s.order === 7)?.whatHappens ?? ""}

## 단계 표

${table(
  ["#", "단계", "배경", "하는 일"],
  USER_USER_STEPS.map((s) => [String(s.order), `${s.phase} (${s.title})`, s.background, s.whatHappens]),
)}

${PREDICTION_SCREEN_FLOW_NOTES.map((l) => `- ${l}`).join("\n")}

## 규칙·배당

${USER_USER_EXTRA.map((l) => `- ${l}`).join("\n")}

### 타석 배당

${table(PREDICTION_ODDS_TABLE.headers, PREDICTION_ODDS_TABLE.rows)}

### 광고

${table(AD_RULE_ROWS.headers, AD_RULE_ROWS.rows)}

## 기술 설명서

${table(
  ["항목", "내용"],
  USER_TECH_STACK.map((r) => [r.label, r.value]),
)}
`;
}

function dbMd(): string {
  const index = table(
    ["영역", "Model", "collection", "역할"],
    MONGO_COLLECTIONS.map((c) => [c.area, c.model, `\`${c.collection}\``, c.role]),
  );

  const details = MONGO_COLLECTIONS.map((col) => {
    const fields = table(
      ["field", "type", "역할·내용", "값/제약"],
      col.fields.map((f) => [f.name, f.type, f.role, f.values ?? ""]),
    );
    const idx = col.indexes?.length ? `\n\n인덱스: ${col.indexes.join(" · ")}` : "";
    const notes = col.notes?.length ? `\n\n${col.notes.map((n) => `> ${n}`).join("\n")}` : "";
    return `### ${col.model} (\`${col.collection}\`)\n\n${col.role}\n\n${fields}${idx}${notes}`;
  }).join("\n\n");

  const live = table(
    ["field", "type", "역할"],
    LIVE_SCOREBOARD_FIELDS.map((f) => [f.name, f.type, f.role]),
  );

  return `# 빠몽이 DB 구조 설명서

기준일: ${MONGO_CATALOG_UPDATED}

## 클러스터 · 데이터베이스

| 항목 | 값 |
| --- | --- |
| 제품 | ${MONGO_CLUSTER.product} |
| Atlas 클러스터 | ${MONGO_CLUSTER.cluster} |
| 데이터베이스 이름 | \`${MONGO_CLUSTER.database}\` |
| 연결 URI | 환경변수 \`${MONGO_CLUSTER.envUri}\` |
| DB 이름 옵션 | 환경변수 \`${MONGO_CLUSTER.envDbName}\` (mongoose \`dbName\`, URI 경로보다 우선) |

${MONGO_CLUSTER.note}

${MONGO_CLUSTER.redisNote}

컬렉션 이름은 Mongoose 기본 복수형입니다. **Stadium만 \`stadia\`** 입니다. \`stadiums\`로 조회하면 비어 있습니다.

## 컬렉션 목록

${index}

## 필드별 역할

${details}

## Match.liveScoreboard (Mixed)

점수·이닝·로고는 다음 스포츠, 주자·B-S·OUT·타자·구종은 네이버입니다. 같은 필드를 두 소스에서 섞지 않습니다.

${live}

## 관계 요약

\`\`\`
users ──┬── predictions ── matches ── stadia
        ├── matchsidebets ──┘
        ├── pointtransactions
        └── mallorders

adminusers.apiSyncEnabled  =  실황 ON (회원 경기 선택 게이트)
roundstatistics + matches.predictionEnabled  =  atBatPhase (Match에 단계 필드 없음)
friendrooms ── friendroommembers
\`\`\`

실황 ON은 Match 필드가 아니라 \`adminusers.apiSyncEnabled\` 입니다. 회원 선택 모달의 \`sideBetEnabled\`는 API가 붙입니다.
\`atBatPhase\`는 Match에 저장하지 않고 \`roundstatistics\` 플래그 + \`matches.predictionEnabled\`로 도출합니다.
`;
}

write("빠몽이_시스템_흐름.md", flowMd());
write("빠몽이_운영자_설명서.md", operatorMd());
write("빠몽이_사용자_설명서.md", userMd());
write("빠몽이_DB구조_설명서.md", dbMd());
