/**
 * 포볼/데드볼 → 1루, 대타 실황 이름 우선 — npx tsx scripts/test-live-result-pinch.ts
 */
import { resolveCurrentBatterPreview } from "../shared/batterDisplay";
import { inferSuggestedResultFromRelays } from "../server/daumLive/naverRelayClient";

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

console.log("live-result-pinch OK");
