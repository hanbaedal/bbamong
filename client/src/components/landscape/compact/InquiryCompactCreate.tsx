import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useUser } from "@/contexts/UserContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import GuestRestrictionPopup, { useGuestRestriction } from "@/components/customUi/guestRestrictionPopup";
import Popup from "@/components/customUi/infoPopup";

const CATEGORIES = ["계정 문제", "게임 문제", "기술적 문제", "기타"] as const;

type Category = (typeof CATEGORIES)[number];

export default function InquiryCompactCreate() {
  const [, setLocation] = useLocation();
  const { user, isGuest } = useUser();
  const { toast } = useToast();
  const { showGuestPopup, setShowGuestPopup, checkGuest } = useGuestRestriction(isGuest);
  const [category, setCategory] = useState<Category | "">("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [alertMessage, setAlertMessage] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("사용자 정보가 없습니다.");
      const response = await apiRequest("POST", "/api/inquiries", {
        category,
        title,
        content,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inquiries"] });
      toast({
        title: "성공",
        description: "문의가 등록되었습니다.",
      });
      setLocation("/home/inquiry");
    },
    onError: (error: Error) => {
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
    <div className="lscape-detail lscape-detail--create" data-testid="inquiry-compact-create">
      <div className="lscape-detail__create-header">
        <h2 className="lscape-detail__create-title">문의하기</h2>
        <button
          type="button"
          data-testid="button-submit"
          onClick={handleSubmit}
          disabled={createMutation.isPending}
          className="lscape-detail__action-btn lscape-detail__action-btn--primary lscape-detail__action-btn--inquiry"
        >
          {createMutation.isPending ? "등록 중..." : "등록"}
        </button>
      </div>

      <div className="lscape-detail__create-form">
        <label className="lscape-detail__create-label" htmlFor="compact-inquiry-category">
          카테고리
        </label>
        <select
          id="compact-inquiry-category"
          data-testid="button-select-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as Category | "")}
          className="lscape-detail__edit-input lscape-detail__edit-select"
        >
          <option value="">문의 카테고리를 선택해 주세요</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <label className="lscape-detail__create-label" htmlFor="compact-inquiry-title">
          제목
        </label>
        <input
          id="compact-inquiry-title"
          type="text"
          data-testid="input-title"
          placeholder="제목을 입력하세요."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="lscape-detail__edit-input"
        />

        <label className="lscape-detail__create-label" htmlFor="compact-inquiry-content">
          내용
        </label>
        <textarea
          id="compact-inquiry-content"
          data-testid="textarea-content"
          placeholder="내용을 입력해 주세요."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="lscape-detail__edit-textarea lscape-detail__edit-textarea--grow"
        />
      </div>

      <GuestRestrictionPopup show={showGuestPopup} onClose={() => setShowGuestPopup(false)} />

      {alertMessage ? (
        <Popup message={alertMessage} buttonText="확인" onConfirm={() => setAlertMessage("")} />
      ) : null}
    </div>
  );
}
