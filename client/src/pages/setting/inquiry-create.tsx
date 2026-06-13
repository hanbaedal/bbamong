import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { ChevronDown, ChevronLeft, Check } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import BottomNavigation from "@/components/BottomNavigation";
import { useUser } from "@/contexts/UserContext";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import GuestRestrictionPopup, { useGuestRestriction } from "@/components/customUi/guestRestrictionPopup";

const CATEGORIES = [
  "계정 문제",
  "게임 문제",
  "기술적 문제",
  "기타",
] as const;

type Category = typeof CATEGORIES[number];

export default function InquiryCreatePage() {
  const [, setLocation] = useLocation();
  const { user, isGuest } = useUser();
  const { toast } = useToast();
  const { showGuestPopup, setShowGuestPopup, checkGuest } = useGuestRestriction(isGuest);

  const [category, setCategory] = useState<Category | "">("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const focusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      const offset = window.innerHeight - vv.height;
      const isVisible = offset > 100;
      setKeyboardVisible(isVisible);
      if (isVisible && focusedElementRef.current) {
        setTimeout(() => {
          focusedElementRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    };

    vv.addEventListener('resize', handleResize);
    vv.addEventListener('scroll', handleResize);
    return () => {
      vv.removeEventListener('resize', handleResize);
      vv.removeEventListener('scroll', handleResize);
    };
  }, []);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    focusedElementRef.current = e.target;
    setTimeout(() => {
      e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  };

  const handleBlur = () => {
    focusedElementRef.current = null;
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("사용자 정보가 없습니다.");
      const response = await apiRequest("POST", "/api/inquiries", {
        userId: user.id,
        category,
        title,
        content,
      });
      return response.json();
    },
    onSuccess: () => {
      // 문의 내역 캐시 무효화 (customer-center의 queryKey와 일치)
      queryClient.invalidateQueries({ queryKey: ["inquiries"] });
      toast({
        title: "성공",
        description: "문의가 등록되었습니다.",
      });
      setLocation("/customer-center");
    },
    onError: (error: any) => {
      toast({
        title: "오류",
        description: error.message || "문의 등록에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (checkGuest()) return;
    if (!category) {
      setAlertMessage("카테고리를 선택해주세요.");
      return;
    }
    if (!title.trim()) {
      setAlertMessage("제목을 입력해주세요.");
      return;
    }
    if (!content.trim()) {
      setAlertMessage("내용을 입력해주세요.");
      return;
    }

    createMutation.mutate();
  };

  return (
    <div className="h-app-screen bg-[#111111]">
      {/* 헤더 */}
      <PageHeader
        leftAction={
          <button
            onClick={() => setLocation("/settings")}
            data-testid="button-back"
            className="p-1 focus:outline-none focus-visible:outline-none"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        }
        rightAction={
          <button
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            className="px-4 py-1 bg-[#E11937] text-white text-sm font-medium rounded disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="button-submit"
          >
            {createMutation.isPending ? "등록 중..." : "등록"}
          </button>
        }
      />

      {/* 폼 */}
      <div className={`flex-1 flex flex-col px-5 pt-[10px] overflow-y-scroll-touch ${keyboardVisible ? 'pb-4' : 'pb-bottom-nav'}`}>
        <h1 data-testid="text-page-title" className="text-white text-[20px] font-bold text-center pt-4 pb-3">문의하기</h1>
        {/* 카테고리 선택 */}
        <button
          onClick={() => setShowCategorySheet(true)}
          className="w-full flex items-center justify-between py-3 border-b border-[#373539] mb-5"
          data-testid="button-select-category"
        >
          <span className={category ? "text-white" : "text-[#6B6B6B]"}>
            {category || "문의 카테고리를 선택해 주세요"}
          </span>
          <ChevronDown className="w-5 h-5 text-[#6B6B6B]" />
        </button>

        {/* 제목 입력 */}
        <div className="mb-5">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder="제목을 입력하세요."
            className="w-full bg-transparent text-white placeholder:text-[#6B6B6B] border-b border-[#373539] py-3 focus:outline-none focus:border-[#CDFF00]"
            data-testid="input-title"
          />
        </div>

        {/* 내용 입력 */}
        <div className="flex-1">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder="내용을 입력해 주세요."
            className="w-full h-full bg-transparent text-white placeholder:text-[#6B6B6B] border-0 py-3 focus:outline-none resize-none"
            data-testid="textarea-content"
          />
        </div>
      </div>

      {/* 카테고리 선택 바텀시트 */}
      {showCategorySheet && (
        <div
          className="fixed inset-0 z-[70] flex items-end"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.7)" }}
          onClick={() => setShowCategorySheet(false)}
        >
          <div
            className="w-full bg-[#1C1C1C] rounded-t-2xl p-5 animate-in slide-in-from-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setCategory(cat);
                    setShowCategorySheet(false);
                  }}
                  className="flex items-center justify-between py-4 hover-elevate active-elevate-2 rounded-lg px-2"
                  data-testid={`category-${cat}`}
                >
                  <span className="text-white text-base">{cat}</span>
                  {category === cat && (
                    <div className="w-5 h-5 rounded-full bg-[#CDFF00] flex items-center justify-center">
                      <Check className="w-3 h-3 text-black" strokeWidth={3} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 알림 팝업 */}
      {!!alertMessage && (
        <>
          <div className="fixed inset-0 bg-[#000000CC] z-[70]" onClick={() => setAlertMessage("")} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[266px] bg-[#2F2F2F] shadow-[0_8px_36px_rgba(0,0,0,0.16)] rounded-[8px] flex flex-col items-center p-[20px_20px_16px] gap-4 z-[75]">
            <div className="w-[226px] flex flex-col justify-center items-center gap-[10px]">
              <p className="text-center text-[#E9E9E9] font-[Pretendard] font-normal text-[16px] leading-[140%] tracking-[-0.025em] whitespace-pre-line">
                {alertMessage}
              </p>
            </div>
            <div className="w-[226px] flex flex-row justify-center items-center">
              <button
                data-testid="button-alert-confirm"
                className="flex-1 h-[40px] bg-[#CCF501] active:bg-[#C8D48D] border border-[#CDFF00] rounded-[6px] flex justify-center items-center p-[10px] gap-[10px] font-[Pretendard] font-semibold text-[14px] leading-[140%] text-[#111111]"
                onClick={() => setAlertMessage("")}
              >
                확인
              </button>
            </div>
          </div>
        </>
      )}
      <GuestRestrictionPopup show={showGuestPopup} onClose={() => setShowGuestPopup(false)} />
      {!keyboardVisible && <BottomNavigation />}
    </div>
  );
}
