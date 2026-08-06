import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { useUserAssets } from "@/contexts/UserAssetContext";
import { useUser } from "@/contexts/UserContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getInquiryStatusClass, getInquiryStatusLabel } from "./noticeUtils";
import SimpleConfirmPopup from "@/components/customUi/simpleConfirmPopup";

type InquiryDetail = {
  id: number;
  userId: string;
  category: string;
  title: string;
  content: string;
  status: string;
  response?: string | null;
  createdAt: string;
};

export default function InquiryCompactDetail() {
  const params = useParams();
  const inquiryId = params.id;
  const [, setLocation] = useLocation();
  const { user, isGuest } = useUser();
  const { assets } = useUserAssets();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: inquiry, isLoading } = useQuery<InquiryDetail>({
    queryKey: ["/api/inquiries", inquiryId],
    enabled: !!inquiryId && !isGuest,
    refetchOnMount: "always",
  });

  const canEdit =
    !isGuest && inquiry && user?.id === inquiry.userId && inquiry.status === "pending";

  const updateMutation = useMutation({
    mutationFn: async (payload: { title: string; content: string }) => {
      const res = await apiRequest("PATCH", `/api/inquiries/${inquiryId}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inquiries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inquiries", inquiryId] });
      setIsEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/inquiries/${inquiryId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inquiries"] });
      setLocation("/home/inquiry");
    },
  });

  const startEdit = () => {
    if (!inquiry) return;
    setEditTitle(inquiry.title);
    setEditContent(inquiry.content);
    setIsEditing(true);
  };

  if (isLoading) {
    return <div className="lscape-detail lscape-detail--loading">불러오는 중...</div>;
  }

  if (!inquiry) {
    return <div className="lscape-detail lscape-detail--empty">문의를 찾을 수 없습니다</div>;
  }

  return (
    <article className="lscape-detail" data-testid="inquiry-compact-detail">
      <div className="lscape-detail__meta">
        <span className={getInquiryStatusClass(inquiry.status)} data-testid="inquiry-status">
          {getInquiryStatusLabel(inquiry.status)}
        </span>
        <span className="lscape-detail__chip" data-testid="inquiry-category">
          {inquiry.category}
        </span>
        <time className="lscape-detail__date" data-testid="inquiry-date">
          {format(new Date(inquiry.createdAt), "yyyy.MM.dd HH:mm")}
        </time>
        {canEdit ? (
          <div className="lscape-detail__actions ml-auto flex gap-1">
            {!isEditing ? (
              <>
                <button
                  type="button"
                  className="lscape-detail__action-btn"
                  data-testid="button-edit-inquiry"
                  onClick={startEdit}
                >
                  수정
                </button>
                <button
                  type="button"
                  className="lscape-detail__action-btn lscape-detail__action-btn--danger"
                  data-testid="button-delete-inquiry"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  삭제
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {isEditing ? (
        <div className="lscape-detail__edit-form">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="lscape-detail__edit-input"
            data-testid="input-edit-inquiry-title"
          />
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="lscape-detail__edit-textarea"
            data-testid="textarea-edit-inquiry-content"
          />
          <div className="lscape-detail__edit-actions">
            <button
              type="button"
              className="lscape-detail__action-btn"
              onClick={() => setIsEditing(false)}
            >
              취소
            </button>
            <button
              type="button"
              className="lscape-detail__action-btn lscape-detail__action-btn--primary"
              disabled={updateMutation.isPending}
              data-testid="button-save-inquiry"
              onClick={() =>
                updateMutation.mutate({
                  title: editTitle.trim(),
                  content: editContent.trim(),
                })
              }
            >
              저장
            </button>
          </div>
        </div>
      ) : (
        <>
          <h2 className="lscape-detail__title" data-testid="inquiry-title">
            {inquiry.title}
          </h2>
          <div
            className="lscape-detail__content lscape-detail__content--question"
            data-testid="inquiry-content"
          >
            {inquiry.content}
          </div>
        </>
      )}

      <section className="lscape-detail__section">
        <h3 className="lscape-detail__section-title">답변</h3>
        {inquiry.response ? (
          <div className="lscape-detail__reply" data-testid="inquiry-response">
            {inquiry.response}
          </div>
        ) : (
          <div className="lscape-detail__no-reply">
            <img
              src={assets.noCommentImg}
              alt=""
              className="lscape-detail__no-reply-img"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
              data-testid="img-no-reply"
            />
            <p data-testid="text-no-reply">도착한 답변이 없습니다</p>
          </div>
        )}
      </section>

      {showDeleteConfirm ? (
        <SimpleConfirmPopup
          message="문의를 삭제하시겠습니까?"
          leftButtonText="삭제"
          rightButtonText="취소"
          onLeftClick={() => deleteMutation.mutate()}
          onRightClick={() => setShowDeleteConfirm(false)}
        />
      ) : null}
    </article>
  );
}
