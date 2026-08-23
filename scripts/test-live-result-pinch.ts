/**
 * 포볼/데드볼 → 1루, 대타, 운영자 다음 액션 — npx tsx scripts/test-live-result-pinch.ts
 */
import { resolveCurrentBatterPreview } from "../shared/batterDisplay";
import { inferSuggestedResultFromRelays } from "../server/daumLive/naverRelayClient";
import { deriveOperatorNextAction } from "../shared/operatorNextAction";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(
  inferSuggestedResultFromRelays(
    [{ textOptions: [{ text: "김태연 볼넷으로 출루" }] }],
    "김태연",
  ) === "1루",
  "볼넷 → 1루",
);
assert(
  inferSuggestedResultFromRelays(
    [{ textOptions: [{ text: "포볼로 걸었습니다" }] }],
    null,
  ) === "1루",
  "포볼 → 1루",
);
assert(
  inferSuggestedResultFromRelays(
    [{ textOptions: [{ text: "몸에 맞는 볼 데드볼" }] }],
    null,
  ) === "1루",
  "데드볼 → 1루",
);
assert(
  inferSuggestedResultFromRelays(
    [{ textOptions: [{ text: "사구로 출루" }] }],
    null,
  ) === "1루",
  "사구 → 1루",
);
assert(
  inferSuggestedResultFromRelays(
    [{ textOptions: [{ text: "1루타 중견수 앞" }] }],
    null,
  ) === "1루",
  "1루타 → 1루",
);
assert(
  inferSuggestedResultFromRelays(
    [{ textOptions: [{ text: "희생플라이 중견수" }] }],
    null,
  ) === "아웃",
  "희생플라이 → 아웃",
);
assert(
  inferSuggestedResultFromRelays(
    [{ textOptions: [{ text: "병살타 유격수-2루수" }] }],
    null,
  ) === "아웃",
  "병살 → 아웃",
);
assert(
  inferSuggestedResultFromRelays(
    [{ textOptions: [{ text: "야수선택으로 출루" }] }],
    null,
  ) === "1루",
  "야수선택 → 1루",
);

const pinch = resolveCurrentBatterPreview({
  lineup: {
    home: [],
    away: [{ playerId: 1, name: "이원석", battingOrder: 1 }],
    source: "test",
  },
  inningHalf: "top",
  batterIndexInHalf: 1,
  season: 2026,
  liveBatterName: "김태연",
});
assert(pinch.playerName === "김태연", `live name ${pinch.playerName}`);
assert(pinch.isPinchHitter === true, "대타 표시");
assert(pinch.orderLabel.includes("1번"), pinch.orderLabel);

// 타순 미등록 + 실황 타자명만 있으면 대타 오탐 금지
const noLineup = resolveCurrentBatterPreview({
  lineup: { home: [], away: [], source: "test" },
  inningHalf: "top",
  batterIndexInHalf: 1,
  season: 2026,
  liveBatterName: "김태연",
});
assert(noLineup.playerName === "김태연", `noLineup name ${noLineup.playerName}`);
assert(noLineup.isPinchHitter === false, "타순 없으면 대타 아님");

const next = deriveOperatorNextAction({
  liveAutoEnabled: true,
  atBatPhase: "prediction_closed",
  suggestedResult: "아웃",
  needsResultBeforeAdvance: true,
});
assert(next.kind === "confirm_result", next.kind);
assert(next.suggestedResult === "아웃", String(next.suggestedResult));

console.log("live-result-pinch OK");
