/**
 * 타석 결과 표시 라벨(사구 포함) 단위 검증.
 * 실행: npx tsx scripts/test-atbat-result-display.ts
 */
import {
  inferAtBatResultDisplayFromText,
  mapAtBatResultDisplayToSuggested,
} from "../shared/atBatResultDisplay";
import {
  inferAtBatResultDisplayFromRelays,
  inferSuggestedResultFromRelays,
  parseNaverLiveSituation,
} from "../server/daumLive/naverRelayClient";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const cases: Array<[string, string]> = [
  ["홈런 좌측 담장", "홈런"],
  ["3루타 우중간", "3루타"],
  ["2루타 좌익수 옆", "2루타"],
  ["1루타 중견수 앞", "1루타"],
  ["포볼로 걸었습니다", "포볼"],
  ["볼넷으로 출루", "포볼"],
  ["고의사구로 출루", "포볼"],
  ["몸에 맞는 볼 데드볼", "사구"],
  ["사구로 출루", "사구"],
  ["삼진 아웃", "삼진아웃"],
  ["병살타 유격수-2루수", "병살타 아웃"],
  ["삼살 플레이", "삼살타 아웃"],
  ["중견수 플라이 아웃", "타격아웃"],
  ["유격수 땅볼", "타격아웃"],
];

for (const [text, expected] of cases) {
  const got = inferAtBatResultDisplayFromText(text);
  assert(got === expected, `${text} → ${got} (expected ${expected})`);
}

assert(mapAtBatResultDisplayToSuggested("사구") === "1루", "사구→1루");
assert(mapAtBatResultDisplayToSuggested("포볼") === "1루", "포볼→1루");
assert(mapAtBatResultDisplayToSuggested("삼진아웃") === "아웃", "삼진→아웃");
assert(mapAtBatResultDisplayToSuggested("1루타") === "1루", "1루타→1루");

assert(
  inferAtBatResultDisplayFromRelays([{ textOptions: [{ text: "사구로 출루" }] }], null) === "사구",
  "relay 사구",
);
assert(inferSuggestedResultFromRelays([{ textOptions: [{ text: "사구로 출루" }] }], null) === "1루", "relay 사구→1루");
assert(
  inferAtBatResultDisplayFromRelays([{ textOptions: [{ text: "포볼로 걸었습니다" }] }], null) ===
    "포볼",
  "relay 포볼",
);
assert(
  inferAtBatResultDisplayFromRelays(
    [
      { title: "김타자", textOptions: [{ text: "삼진 아웃" }] },
      { title: "이타자", textOptions: [] },
    ],
    "이타자",
  ) === "삼진아웃",
  "next batter still shows previous 삼진아웃",
);

const payload = {
  result: {
    textRelayData: {
      homeOrAway: "0",
      currentGameState: {
        ball: 0,
        strike: 0,
        out: 1,
        base1: "1",
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
          textOptions: [{ type: 0, text: "몸에 맞는 볼로 출루" }],
          ptsOptions: [],
        },
      ],
    },
  },
};
const sit = parseNaverLiveSituation(payload);
assert(sit?.atBatResultDisplay === "사구", `parse display ${sit?.atBatResultDisplay}`);
assert(sit?.suggestedResult === "1루", `parse suggested ${sit?.suggestedResult}`);

const pregame = parseNaverLiveSituation({
  result: {
    textRelayData: {
      homeOrAway: "0",
      awayLineup: { batter: [{ pcode: "100", name: "선발타자", hitType: "우타" }] },
      homeLineup: { pitcher: [{ pcode: "200", name: "선발투수" }] },
    },
  },
});
assert(pregame?.pitcherName === "선발투수", `pregame pitcher ${pregame?.pitcherName}`);
assert(pregame?.batterName === "선발타자", `pregame batter ${pregame?.batterName}`);

console.log("OK: at-bat result display (incl. 사구)");
