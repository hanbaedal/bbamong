/**
 * 문자 기반 B-S coalesce / 서버 타석 집계 단위 검증.
 * 실행: npx tsx scripts/test-text-based-bs.ts
 */
import type { LiveScoreSituation } from "../shared/apiSportsTypes";
import {
  applyPitchResultToBallsStrikes,
  coalesceLiveSituation,
  extractPitchResultKeyFromLabel,
  preferAheadBallsStrikes,
} from "../shared/liveSituationDisplay";
import {
  countCurrentAtBatBallsStrikes,
  parseNaverLiveSituation,
} from "../server/daumLive/naverRelayClient";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function baseSit(partial: Partial<LiveScoreSituation>): LiveScoreSituation {
  return {
    balls: 0,
    strikes: 0,
    outs: 0,
    first: false,
    second: false,
    third: false,
    batterName: "김타자",
    pitcherName: null,
    pitcher: null,
    batterToday: null,
    batsSide: null,
    pitchLocations: null,
    pitchLabel: null,
    pitchDetail: null,
    suggestedResult: null,
    ...partial,
  };
}

// --- label extract ---
assert(extractPitchResultKeyFromLabel("3구 볼") === "B", "볼");
assert(extractPitchResultKeyFromLabel("2구 스트라이크") === "T", "스트라이크");
assert(extractPitchResultKeyFromLabel("1구 헛스윙") === "S", "헛스윙");
assert(extractPitchResultKeyFromLabel("4구 파울") === "F", "파울");
assert(extractPitchResultKeyFromLabel("5구 타격") === "H", "타격");

// --- apply rules ---
assert(
  JSON.stringify(applyPitchResultToBallsStrikes(0, 0, "B")) === JSON.stringify({ balls: 1, strikes: 0 }),
  "B",
);
assert(
  JSON.stringify(applyPitchResultToBallsStrikes(0, 2, "F")) === JSON.stringify({ balls: 0, strikes: 2 }),
  "F at 2S",
);
assert(
  JSON.stringify(applyPitchResultToBallsStrikes(0, 1, "F")) === JSON.stringify({ balls: 0, strikes: 2 }),
  "F at 1S",
);

// --- coalesce: pts 없을 때 pitchLabel로 B-S 전진 ---
{
  const prev = baseSit({ balls: 1, strikes: 1, pitchLabel: "2구 스트라이크" });
  const next = baseSit({ balls: 1, strikes: 1, pitchLabel: "3구 볼", pitchLocations: null });
  const out = coalesceLiveSituation(next, prev);
  assert(out.balls === 2 && out.strikes === 1, `text coalesce got ${out.balls}-${out.strikes}`);
  assert(out.pitchLocations == null, "존 점은 추가되면 안 됨");
}

// --- coalesce: pts 있으면 pts result 사용 ---
{
  const prev = baseSit({ balls: 0, strikes: 0, pitchLabel: "1구 볼", pitchLocations: [] });
  const next = baseSit({
    balls: 0,
    strikes: 0,
    pitchLabel: "2구 스트라이크",
    pitchLocations: [
      { pitchNum: 1, result: "B", plateX: 0, plateZ: 2, topSz: 3.5, bottomSz: 1.5, stance: null },
      { pitchNum: 2, result: "T", plateX: 0.1, plateZ: 2.1, topSz: 3.5, bottomSz: 1.5, stance: null },
    ],
  });
  const out = coalesceLiveSituation(next, prev);
  assert(out.balls === 0 && out.strikes === 1, `pts coalesce got ${out.balls}-${out.strikes}`);
  assert((out.pitchLocations?.length ?? 0) === 2, "pts 유지");
}

// --- coalesce: 이미 state 갱신되면 유지 ---
{
  const prev = baseSit({ balls: 1, strikes: 0, pitchLabel: "1구 볼" });
  const next = baseSit({ balls: 2, strikes: 0, pitchLabel: "2구 볼" });
  const out = coalesceLiveSituation(next, prev);
  assert(out.balls === 2 && out.strikes === 0, "state already updated");
}

// --- preferAhead ---
assert(
  JSON.stringify(preferAheadBallsStrikes({ balls: 1, strikes: 0 }, { balls: 2, strikes: 1 })) ===
    JSON.stringify({ balls: 2, strikes: 1 }),
  "prefer ahead text",
);

// --- server count from textOptions ---
{
  const relays = [
    {
      title: "김타자",
      textOptions: [
        { type: 1, pitchNum: 1, pitchResult: "B", text: "1구 볼" },
        { type: 1, pitchNum: 2, pitchResult: "T", text: "2구 스트라이크" },
        { type: 1, pitchNum: 3, pitchResult: "B", text: "3구 볼" },
      ],
    },
  ];
  const counted = countCurrentAtBatBallsStrikes(relays, "김타자");
  assert(counted?.balls === 2 && counted?.strikes === 1, `count got ${JSON.stringify(counted)}`);
}

// --- parseNaverLiveSituation: text ahead of state ---
{
  const payload = {
    result: {
      textRelayData: {
        homeOrAway: "0",
        currentGameState: {
          ball: 1,
          strike: 1,
          out: 0,
          base1: "0",
          base2: "0",
          base3: "0",
          batter: "100",
          pitcher: "200",
        },
        awayLineup: {
          batter: [{ pcode: "100", name: "김타자", hitType: "우타" }],
          pitcher: [{ pcode: "200", name: "박투수" }],
        },
        homeLineup: { batter: [], pitcher: [] },
        textRelays: [
          {
            title: "김타자",
            textOptions: [
              { type: 1, pitchNum: 1, pitchResult: "B", text: "1구 볼" },
              { type: 1, pitchNum: 2, pitchResult: "T", text: "2구 스트라이크" },
              { type: 1, pitchNum: 3, pitchResult: "B", text: "3구 볼" },
            ],
            ptsOptions: [],
          },
        ],
      },
    },
  };
  const sit = parseNaverLiveSituation(payload);
  assert(sit != null, "parse null");
  assert(sit!.balls === 2 && sit!.strikes === 1, `parse BS ${sit!.balls}-${sit!.strikes}`);
  assert(sit!.pitchLabel === "3구 볼", `label ${sit!.pitchLabel}`);
  assert(sit!.pitchLocations == null, "pts empty → no fake zone dots");
}

console.log("OK: text-based B-S coalesce + server parse");
