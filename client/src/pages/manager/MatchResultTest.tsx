import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { managerQueryClient, managerFetch } from "@/lib/managerQueryClient";
import { Loader2 } from "lucide-react";

interface Match {
  id: string;
  name: string;
  stadiumId: number;
  startTime: string;
  endTime: string;
  matchStatus: string;
  currentRound: number;
  predictionEnabled: boolean;
}

interface TestResultResponse {
  success: boolean;
  message: string;
  clientCount: number;
  winnerCount: number;
  totalPredictions: number;
}

const PREDICTION_OPTIONS = ["1루", "2루", "3루", "홈런", "아웃"];

export default function MatchResultTest() {
  const { toast } = useToast();
  const [selectedResults, setSelectedResults] = useState<Record<string, string>>({});

  const { data: matches, isLoading } = useQuery<Match[]>({
    queryKey: ["/api/matches"],
  });

  const startRoundMutation = useMutation({
    mutationFn: async (matchId: string) => {
      const response = await managerFetch(`/api/live-match/control/${matchId}/round/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "라운드 시작 실패");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "라운드 시작",
        description: `라운드 ${data.currentRound} 예측이 시작되었습니다.`,
      });
      managerQueryClient.invalidateQueries({ queryKey: ["/api/matches"] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "시작 실패",
        description: error.message,
      });
    },
  });

  const stopRoundMutation = useMutation({
    mutationFn: async (matchId: string) => {
      const response = await managerFetch(`/api/live-match/control/${matchId}/round/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "라운드 중지 실패");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "라운드 중지",
        description: `라운드 ${data.currentRound} 예측이 중지되었습니다.`,
      });
      managerQueryClient.invalidateQueries({ queryKey: ["/api/matches"] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "중지 실패",
        description: error.message,
      });
    },
  });

  const sendRoundResultMutation = useMutation({
    mutationFn: async ({ matchId, result }: { matchId: string; result: string }) => {
      const response = await managerFetch(`/api/live-match/control/${matchId}/round/result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "결과 전송 실패");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "라운드 결과 발표",
        description: `라운드 ${data.roundNumber} 결과: ${data.result}\n참여: ${data.stats.totalParticipants}명, 승자: ${data.stats.totalWinners}명`,
      });
      managerQueryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      setSelectedResults(prev => {
        const newState = { ...prev };
        delete newState[data.matchId];
        return newState;
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "전송 실패",
        description: error.message,
      });
    },
  });

  const sendResultMutation = useMutation({
    mutationFn: async ({ matchId, result }: { matchId: string; result: string }) => {
      const response = await managerFetch(`/api/live-match/test/${matchId}/result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "결과 전송 실패");
      }
      
      return response.json() as Promise<TestResultResponse>;
    },
    onSuccess: (data, variables) => {
      const match = matches?.find(m => m.id === variables.matchId);
      toast({
        title: "결과 전송 완료",
        description: `${match?.name} - ${variables.result}\n연결: ${data.clientCount}명, 승자: ${data.winnerCount}명/${data.totalPredictions}명`,
      });
      managerQueryClient.invalidateQueries({ queryKey: ["/api/matches"] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "전송 실패",
        description: error.message,
      });
    },
  });

  const handleSendResult = (matchId: string) => {
    const result = selectedResults[matchId];
    if (!result) {
      toast({
        variant: "destructive",
        title: "결과를 선택하세요",
        description: "예측 결과를 먼저 선택해주세요.",
      });
      return;
    }

    sendResultMutation.mutate({ matchId, result });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto px-3 py-3 space-y-3">
      <div className="space-y-1">
        <h1 className="text-xl font-bold">경기 결과 테스트</h1>
        <p className="text-muted-foreground text-xs">
          테스트용 경기 결과 전송 페이지입니다.
        </p>
      </div>

      <div className="grid gap-2">
        {matches?.map((match) => (
          <Card key={match.id} data-testid={`card-match-${match.id}`}>
            <CardHeader className="px-3 py-2">
              <CardTitle className="text-sm">{match.name}</CardTitle>
              <CardDescription className="text-xs">
                상태: {match.matchStatus} | R{match.currentRound} | 
                예측 {match.predictionEnabled ? "O" : "X"}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-0 space-y-2">
              <div className="flex items-center gap-1.5">
                <Button
                  data-testid={`button-start-round-${match.id}`}
                  onClick={() => startRoundMutation.mutate(match.id)}
                  disabled={match.predictionEnabled || startRoundMutation.isPending}
                  variant={match.predictionEnabled ? "secondary" : "default"}
                  size="sm"
                >
                  {startRoundMutation.isPending ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      시작 중...
                    </>
                  ) : (
                    "예측 시작"
                  )}
                </Button>
                <Button
                  data-testid={`button-stop-round-${match.id}`}
                  onClick={() => stopRoundMutation.mutate(match.id)}
                  disabled={!match.predictionEnabled || stopRoundMutation.isPending}
                  variant={!match.predictionEnabled ? "secondary" : "destructive"}
                  size="sm"
                >
                  {stopRoundMutation.isPending ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      중지 중...
                    </>
                  ) : (
                    "예측 중지"
                  )}
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Select
                    value={selectedResults[match.id] || ""}
                    onValueChange={(value) =>
                      setSelectedResults((prev) => ({ ...prev, [match.id]: value }))
                    }
                  >
                    <SelectTrigger data-testid={`select-result-${match.id}`} className="h-8 text-sm">
                      <SelectValue placeholder="결과 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {PREDICTION_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  data-testid={`button-send-round-result-${match.id}`}
                  onClick={() => {
                    const result = selectedResults[match.id];
                    if (result) {
                      sendRoundResultMutation.mutate({ matchId: match.id, result });
                    }
                  }}
                  disabled={!selectedResults[match.id] || sendRoundResultMutation.isPending}
                  variant="default"
                  size="sm"
                >
                  {sendRoundResultMutation.isPending ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      전송 중...
                    </>
                  ) : (
                    "결과 발표"
                  )}
                </Button>
              </div>

              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-1">레거시 (전체 결과)</p>
                <Button
                  data-testid={`button-send-result-${match.id}`}
                  onClick={() => handleSendResult(match.id)}
                  disabled={!selectedResults[match.id] || sendResultMutation.isPending}
                  variant="outline"
                  size="sm"
                >
                  {sendResultMutation.isPending ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      전송 중...
                    </>
                  ) : (
                    "전체 결과 전송"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!matches || matches.length === 0 ? (
        <Card>
          <CardContent className="py-4 text-center text-muted-foreground text-sm">
            등록된 경기가 없습니다.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
