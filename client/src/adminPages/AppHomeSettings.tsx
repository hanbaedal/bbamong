import { useEffect, useState } from "react";
import AdminLayout from "./adminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/adminQueryClient";
import { useAdminAssets } from "@/contexts/AdminAssetContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

type Tab = "basic" | "game";

interface HomePageSettings {
  greetingPrefix: string;
  subGreeting: string;
  buttonText: string;
  buttonEnabled: boolean;
  showDate: boolean;
  gameGuideTitle: string;
  gameGuideSummary: string;
  gameGuideContent: string;
  gameGuideEnabled: boolean;
  gameGuideImageUrl: string;
  goodsSectionTitle: string;
  goodsSectionEnabled: boolean;
  introVideoUrl?: string;
  shopInquiryEmail?: string;
  shopInquiryPhone?: string;
}

export default function AppHomeSettingsPage() {
  const { assets } = useAdminAssets();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("basic");
  const [settingsForm, setSettingsForm] = useState<HomePageSettings | null>(null);

  const { data, isLoading } = useQuery<{ settings: HomePageSettings }>({
    queryKey: ["/api/admin/homepage-settings"],
    select: (payload) => ({ settings: payload.settings }),
  });

  useEffect(() => {
    if (data?.settings) {
      setSettingsForm(data.settings);
    }
  }, [data]);

  const saveSettingsMutation = useMutation({
    mutationFn: async (payload: HomePageSettings) =>
      apiRequest("PUT", "/api/admin/homepage-settings", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/homepage-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/homepage-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/homepage/content"] });
      toast({ description: "저장되었습니다." });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", description: err.message || "저장 실패" });
    },
  });

  const tabs: { id: Tab; label: string }[] = [
    { id: "basic", label: "앱 홈 기본" },
    { id: "game", label: "예측 게임 설명" },
  ];

  if (isLoading || !settingsForm) {
    return (
      <AdminLayout>
        <div className="text-[#BFBFBF] p-8">불러오는 중...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex flex-col h-full min-h-0">
        <div className="flex items-center gap-2 mb-3 shrink-0">
          <span className="text-xs text-[#BFBFBF]">기본</span>
          <span className="text-xs text-[#BFBFBF]">&gt;</span>
          <span className="text-xs text-[#201E22]">앱 홈 설정</span>
        </div>

        <h1 className="text-xl lg:text-2xl xl:text-[1.75rem] font-semibold text-[#201E22] flex items-center gap-2 mb-4">
          <img src={assets.adMatchCharaterIcon} className="w-8 h-8 lg:w-9 lg:h-9" alt="" />
          앱 홈 설정
        </h1>

        <div className="flex gap-2 border-b border-[#E9E9E9] mb-4 overflow-x-auto shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`pb-2 px-3 text-sm whitespace-nowrap font-medium border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "border-[#E11936] text-[#E11936]"
                  : "border-transparent text-[#888]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto min-h-0 w-full max-w-none pb-4 lg:pb-6">
          {activeTab === "basic" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveSettingsMutation.mutate(settingsForm);
              }}
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5"
            >
              <p className="text-sm lg:text-base text-[#666] md:col-span-2 xl:col-span-3">
                사용자 앱 로그인 후 홈 화면에 표시되는 문구입니다.
              </p>
              <div className="space-y-2">
                <Label>인사말 (이름 앞)</Label>
                <Input
                  value={settingsForm.greetingPrefix}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, greetingPrefix: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>부가 문구</Label>
                <Input
                  value={settingsForm.subGreeting}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, subGreeting: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>경기 참여 버튼 문구</Label>
                <Input
                  value={settingsForm.buttonText}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, buttonText: e.target.value })
                  }
                />
              </div>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={settingsForm.showDate}
                  onCheckedChange={(v) => setSettingsForm({ ...settingsForm, showDate: !!v })}
                />
                <span className="text-sm">날짜 표시</span>
              </label>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={settingsForm.buttonEnabled}
                  onCheckedChange={(v) => setSettingsForm({ ...settingsForm, buttonEnabled: !!v })}
                />
                <span className="text-sm">경기 참여 버튼 표시</span>
              </label>
              <Button type="submit" className="bg-[#E11936] hover:bg-[#B71C1C] lg:col-span-2">
                저장
              </Button>
            </form>
          )}

          {activeTab === "game" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveSettingsMutation.mutate(settingsForm);
              }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5"
            >
              <p className="text-sm lg:text-base text-[#666] lg:col-span-2">
                사용자 앱 홈에서 &apos;야구 예측 게임&apos; 소개와 상세 페이지에 표시됩니다.
              </p>
              <label className="flex items-center gap-2 lg:col-span-2">
                <Checkbox
                  checked={settingsForm.gameGuideEnabled}
                  onCheckedChange={(v) =>
                    setSettingsForm({ ...settingsForm, gameGuideEnabled: !!v })
                  }
                />
                <span className="text-sm">예측 게임 설명 노출</span>
              </label>
              <div className="space-y-2">
                <Label>제목</Label>
                <Input
                  value={settingsForm.gameGuideTitle}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, gameGuideTitle: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>요약 (홈 화면 카드)</Label>
                <Textarea
                  value={settingsForm.gameGuideSummary}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, gameGuideSummary: e.target.value })
                  }
                  rows={3}
                />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label>상세 내용</Label>
                <Textarea
                  value={settingsForm.gameGuideContent}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, gameGuideContent: e.target.value })
                  }
                  rows={12}
                />
              </div>
              <div className="space-y-2">
                <Label>이미지 URL (선택)</Label>
                <Input
                  value={settingsForm.gameGuideImageUrl}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, gameGuideImageUrl: e.target.value })
                  }
                />
              </div>
              <Button type="submit" className="bg-[#E11936] hover:bg-[#B71C1C] lg:col-span-2">
                저장
              </Button>
            </form>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
