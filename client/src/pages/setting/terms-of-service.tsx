import { ChevronLeft } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import BottomNavigation from "@/components/BottomNavigation";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

type Term = {
  id: number;
  title: string;
  content: string;
  type: string;
  createdAt: string;
  updatedAt: string;
};

export default function TermsOfServicePage() {
  const [, setLocation] = useLocation();

  const { data: terms = [], isLoading } = useQuery<Term[]>({
    queryKey: ["/api/terms", { type: "service" }],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/terms?type=service");
      return res.json() as Promise<Term[]>;
    },
    refetchOnMount: "always",
  });

  return (
    <div className="h-app-screen bg-[#111111] w-full">
      <PageHeader
        leftAction={
          <button
            onClick={() => setLocation("/settings")}
            data-testid="button-back"
            className="p-1"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        }
      />

      {/* 스크롤 가능한 컨텐츠 */}
      <div className="flex-1 overflow-y-scroll-touch px-5 pt-[10px] pb-bottom-nav">
        <h1 data-testid="text-page-title" className="text-white text-[20px] font-bold text-center pt-4 pb-3">이용약관</h1>
        {isLoading ? (
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <div className="h-5 w-48 bg-[#1A1A1A] rounded mb-3 animate-pulse"></div>
                <div className="space-y-2">
                  <div className="h-3.5 w-full bg-[#1A1A1A] rounded animate-pulse"></div>
                  <div className="h-3.5 w-5/6 bg-[#1A1A1A] rounded animate-pulse"></div>
                  <div className="h-3.5 w-4/5 bg-[#1A1A1A] rounded animate-pulse"></div>
                  <div className="h-3.5 w-full bg-[#1A1A1A] rounded animate-pulse"></div>
                  <div className="h-3.5 w-3/4 bg-[#1A1A1A] rounded animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        ) : terms.length > 0 ? (
          <div className="space-y-6">
            {terms.map((term) => (
              <div key={term.id} data-testid={`term-${term.id}`}>
                <h3 className="text-white text-base font-semibold mb-3">
                  {term.title}
                </h3>
                <div className="text-[#D5D5D5] text-sm leading-[160%] whitespace-pre-wrap">
                  {term.content}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-10">
            <p className="text-[#6B6B6B] text-sm">이용약관이 준비 중입니다.</p>
          </div>
        )}
      </div>
      <BottomNavigation />
    </div>
  );
}
