import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useUser } from "@/contexts/UserContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import GuestRestrictionPopup, { useGuestRestriction } from "@/components/customUi/guestRestrictionPopup";
import Popup from "@/components/customUi/infoPopup";

export default function BoardCompactCreate() {
  const [, setLocation] = useLocation();
  const { user, isGuest } = useUser();
  const { showGuestPopup, setShowGuestPopup, checkGuest } = useGuestRestriction(isGuest);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [emptyMessage, setEmptyMessage] = useState("");

  const createPostMutation = useMutation({
    mutationFn: async (data: { title: string; content: string }) => {
      const res = await apiRequest("POST", "/api/posts", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      setLocation("/home/board?created=true");
    },
  });

  const handleSubmit = () => {
    if (checkGuest()) return;

    if (!title.trim()) {
      setEmptyMessage("제목을 입력해주세요.");
      return;
    }
    if (!content.trim()) {
      setEmptyMessage("내용을 입력해주세요.");
      return;
    }
    if (!user) {
      setEmptyMessage("로그인이 필요합니다.");
      return;
    }

    createPostMutation.mutate({
      title: title.trim(),
      content: content.trim(),
    });
  };

  return (
    <div className="lscape-detail lscape-detail--create" data-testid="board-compact-create">
      <div className="lscape-detail__create-header">
        <h2 className="lscape-detail__create-title">글쓰기</h2>
        <button
          type="button"
          data-testid="button-submit-post"
          onClick={handleSubmit}
          disabled={createPostMutation.isPending}
          className="lscape-detail__action-btn lscape-detail__action-btn--primary"
        >
          {createPostMutation.isPending ? "등록중..." : "등록"}
        </button>
      </div>

      <div className="lscape-detail__create-form">
        <label className="lscape-detail__create-label" htmlFor="compact-post-title">
          제목
        </label>
        <input
          id="compact-post-title"
          type="text"
          data-testid="input-post-title"
          placeholder="제목을 입력해주세요."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="lscape-detail__edit-input"
        />

        <label className="lscape-detail__create-label" htmlFor="compact-post-content">
          내용
        </label>
        <textarea
          id="compact-post-content"
          data-testid="textarea-post-content"
          placeholder="내용을 입력해 주세요."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="lscape-detail__edit-textarea lscape-detail__edit-textarea--grow"
        />
      </div>

      <GuestRestrictionPopup show={showGuestPopup} onClose={() => setShowGuestPopup(false)} />

      {emptyMessage ? (
        <Popup message={emptyMessage} buttonText="확인" onConfirm={() => setEmptyMessage("")} />
      ) : null}
    </div>
  );
}
