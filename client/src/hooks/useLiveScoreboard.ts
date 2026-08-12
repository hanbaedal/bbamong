import { useQuery } from "@tanstack/react-query";
import { getFullUrl } from "@/lib/queryClient";
import { shouldClientPollMatch } from "@/lib/matchPollWindow";
import type { LiveScoreboard, CurrentBatterPreview } from "@shared/apiSportsTypes";

type LiveScoreboardOptions = {
  pollMs?: number;
  startTime?: string | Date | null;
  matchStatus?: string | null;
  /** 관리자 실시간 모니터링 등 — 시작 1분 전 규칙 무시 */
  alwaysPoll?: boolean;
};

export function useLiveScoreboard(matchId?: string | null, options?: LiveScoreboardOptions) {
  const pollMs = options?.pollMs ?? 3000;
  const alwaysPoll = options?.alwaysPoll ?? false;
  const shouldPoll =
    alwaysPoll || shouldClientPollMatch(options?.startTime, options?.matchStatus);

  return useQuery<{
    scoreboard: LiveScoreboard | null;
    controlMode: string;
    linked: boolean;
    currentBatter: CurrentBatterPreview | null;
  }>({
    queryKey: ["/api/matches", matchId, "scoreboard"],
    enabled: Boolean(matchId),
    refetchInterval: shouldPoll ? pollMs : false,
    queryFn: async () => {
      const res = await fetch(getFullUrl(`/api/matches/${matchId}/scoreboard`));
      if (res.status === 429) {
        console.log("[Scoreboard] 요청 제한 (429) - 기존 캐시 유지");
        throw new Error("RATE_LIMITED");
      }
      if (!res.ok) throw new Error("스코어보드 조회 실패");
      return res.json();
    },
  });
}

export function useApiSportsHealth(pollMs = 5000) {
  return useQuery({
    queryKey: ["/api/api-sports/health"],
    refetchInterval: pollMs,
    queryFn: async () => {
      const res = await fetch(getFullUrl("/api/api-sports/health"));
      if (!res.ok) throw new Error("헬스 조회 실패");
      return res.json();
    },
  });
}
