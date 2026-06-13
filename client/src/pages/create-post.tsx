import { useState, useEffect, useRef } from "react";
import PageHeader from "@/components/PageHeader";
import BottomNavigation from "@/components/BottomNavigation";
import { useLocation } from "wouter";
import { useUser } from "@/contexts/UserContext";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Popup from "@/components/customUi/infoPopup";
import SimpleConfirmPopup from "@/components/customUi/simpleConfirmPopup";
import { useUserAssets } from "@/contexts/UserAssetContext";
import { ChevronLeft } from "lucide-react";
import GuestRestrictionPopup, { useGuestRestriction } from "@/components/customUi/guestRestrictionPopup";

export default function CreatePostPage() {
  const [, setLocation] = useLocation();
  const { user, isGuest } = useUser();
  const { assets } = useUserAssets();
  const { showGuestPopup, setShowGuestPopup, checkGuest } = useGuestRestriction(isGuest);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [showEmptyPopup, setShowEmptyPopup] = useState(false);
  const [emptyMessage, setEmptyMessage] = useState("");
  const [showBackConfirm, setShowBackConfirm] = useState(false);
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

  const createPostMutation = useMutation({
    mutationFn: async (data: { title: string; content: string; authorId: string }) => {
      const res = await apiRequest("POST", "/api/posts", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      setLocation("/board?created=true");
    },
  });

  const handleBack = () => {
    if (title.trim() || content.trim()) {
      setShowBackConfirm(true);
    } else {
      setLocation("/board");
    }
  };

  const handleSubmit = () => {
    if (checkGuest()) return;

    if (!title.trim()) {
      setEmptyMessage("제목을 입력해주세요.");
      setShowEmptyPopup(true);
      return;
    }

    if (!content.trim()) {
      setEmptyMessage("내용을 입력해주세요.");
      setShowEmptyPopup(true);
      return;
    }

    if (!user) {
      setEmptyMessage("로그인이 필요합니다.");
      setShowEmptyPopup(true);
      return;
    }

    createPostMutation.mutate({
      title: title.trim(),
      content: content.trim(),
      authorId: user.id,
    });
  };

  return (
    <div className="h-app-screen bg-[#111111]">
      {/* 헤더 */}
      <PageHeader
        leftAction={
          <button
            onClick={handleBack}
            data-testid="button-back"
            className="p-1 focus:outline-none"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        }
        borderBottom
        rightAction={
          <button
            data-testid="button-submit-post"
            onClick={handleSubmit}
            disabled={createPostMutation.isPending}
            className="bg-[#FF3B4E] text-white px-4 py-1.5 rounded text-sm font-medium disabled:opacity-50"
          >
            {createPostMutation.isPending ? "등록중..." : "등록"}
          </button>
        }
      />

      {/* 컨텐츠 */}
      <div className={`flex-1 flex flex-col px-5 pt-[10px] overflow-y-scroll-touch min-h-0 ${keyboardVisible ? 'pb-4' : 'pb-bottom-nav'}`}>
        <h1 data-testid="text-page-title" className="text-white text-[20px] font-bold text-center pt-4 pb-3 flex-shrink-0">글쓰기</h1>
        <input
          type="text"
          data-testid="input-post-title"
          placeholder="제목을 입력해주세요."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className="w-full bg-transparent text-white text-[20px] font-[600] mb-4 placeholder:text-[#6B6B6B] focus:outline-none border-b border-[#373539] pb-2 flex-shrink-0"
        />
        <textarea
          data-testid="textarea-post-content"
          placeholder="내용을 입력해 주세요."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className="w-full flex-1 bg-transparent text-white text-sm placeholder:text-[#6B6B6B] focus:outline-none resize-none min-h-[200px]"
        />
      </div>

      <GuestRestrictionPopup show={showGuestPopup} onClose={() => setShowGuestPopup(false)} />

      {/* 유효성 검사 팝업 */}
      {showEmptyPopup && (
        <Popup
          message={emptyMessage}
          buttonText="확인"
          onConfirm={() => setShowEmptyPopup(false)}
        />
      )}

      {/* 뒤로가기 확인 팝업 */}
      {showBackConfirm && (
        <SimpleConfirmPopup
          message={`뒤로가시겠어요?\n작성중인 글은 저장되지 않습니다.`}
          leftButtonText="뒤로가기"
          rightButtonText="이어서 글쓰기"
          onLeftClick={() => setLocation("/board")}
          onRightClick={() => setShowBackConfirm(false)}
        />
      )}
      {!keyboardVisible && <BottomNavigation />}
    </div>
  );
}
