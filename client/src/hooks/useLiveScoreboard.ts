import { useQuery } from "@tanstack/react-query";
import { getFullUrl } from "@/lib/queryClient";
import type { LiveScoreboard } from "@shared/apiSportsTypes";

export function useLiveScoreboard(matchId?: string | null, pollMs = 3000) {
  return useQuery<{ scoreboard: LiveScoreboard | null; controlMode: string; linked: boolean }>({
    queryKey: ["/api/matches", matchId, "scoreboard"],
    enabled: Boolean(matchId),
    refetchInterval: pollMs,
    queryFn: async () => {
      const res = await fetch(getFullUrl(`/api/matches/${matchId}/scoreboard`));
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
