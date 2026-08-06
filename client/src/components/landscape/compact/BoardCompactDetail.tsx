import { useState, useEffect, useRef } from "react";
import { ArrowUp } from "lucide-react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import { useUser } from "@/contexts/UserContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import GuestRestrictionPopup, { useGuestRestriction } from "@/components/customUi/guestRestrictionPopup";
import SimpleConfirmPopup from "@/components/customUi/simpleConfirmPopup";

interface PostDetail {
  id: number;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: Date;
  viewCount: number;
}

interface Comment {
  id: number;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: Date;
}

export default function BoardCompactDetail() {
  const params = useParams();
  const postId = parseInt(params.id || "0", 10);
  const [, setLocation] = useLocation();
  const { user, isGuest } = useUser();
  const [commentContent, setCommentContent] = useState("");
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const commentBarRef = useRef<HTMLDivElement>(null);
  const { showGuestPopup, setShowGuestPopup, checkGuest } = useGuestRestriction(isGuest);

  useEffect(() => {
    if (Capacitor.getPlatform() !== "ios") return;
    const vv = window.visualViewport;
    if (!vv) return;
    const handleResize = () => {
      const offset = window.innerHeight - vv.height;
      setKeyboardOffset(offset > 0 ? offset : 0);
    };
    vv.addEventListener("resize", handleResize);
    vv.addEventListener("scroll", handleResize);
    return () => {
      vv.removeEventListener("resize", handleResize);
      vv.removeEventListener("scroll", handleResize);
    };
  }, []);

  const { data: post, isLoading: postLoading } = useQuery<PostDetail>({
    queryKey: ["/api/posts", postId],
    refetchOnMount: "always",
  });

  const { data: comments = [], isLoading: commentsLoading } = useQuery<Comment[]>({
    queryKey: ["/api/posts", postId, "comments"],
    refetchOnMount: "always",
  });

  const isOwner = !isGuest && post && user?.id === post.authorId;

  const createCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/posts/${postId}/comments`, { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts", postId, "comments"] });
      setCommentContent("");
    },
  });

  const updatePostMutation = useMutation({
    mutationFn: async (payload: { title: string; content: string }) => {
      const res = await apiRequest("PATCH", `/api/posts/${postId}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts", postId] });
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      setIsEditing(false);
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/posts/${postId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      setLocation("/home/board");
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: number) => {
      await apiRequest("DELETE", `/api/comments/${commentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts", postId, "comments"] });
    },
  });

  const formatDate = (date: Date) => {
    const d = new Date(date);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const startEdit = () => {
    if (!post) return;
    setEditTitle(post.title);
    setEditContent(post.content);
    setIsEditing(true);
  };

  if (postLoading || !post) {
    return <div className="lscape-detail lscape-detail--loading">불러오는 중...</div>;
  }

  return (
    <div className="lscape-detail lscape-detail--with-comments" data-testid="board-compact-detail">
      <article className="lscape-detail__post">
        <div className="lscape-detail__meta lscape-detail__meta--board">
          <time>{formatDate(post.createdAt)}</time>
          <span>{post.authorName}</span>
          <span>조회 {post.viewCount}</span>
          {isOwner ? (
            <div className="lscape-detail__actions ml-auto flex gap-1">
              {!isEditing ? (
                <>
                  <button
                    type="button"
                    className="lscape-detail__action-btn"
                    data-testid="button-edit-post"
                    onClick={startEdit}
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    className="lscape-detail__action-btn lscape-detail__action-btn--danger"
                    data-testid="button-delete-post"
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
              data-testid="input-edit-post-title"
            />
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="lscape-detail__edit-textarea"
              data-testid="textarea-edit-post-content"
            />
            <div className="lscape-detail__edit-actions">
              <button type="button" className="lscape-detail__action-btn" onClick={() => setIsEditing(false)}>
                취소
              </button>
              <button
                type="button"
                className="lscape-detail__action-btn lscape-detail__action-btn--primary"
                disabled={updatePostMutation.isPending}
                data-testid="button-save-post"
                onClick={() =>
                  updatePostMutation.mutate({
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
            <h2 className="lscape-detail__title">{post.title}</h2>
            <div className="lscape-detail__content">{post.content}</div>
          </>
        )}
      </article>

      <section className="lscape-detail__section lscape-detail__section--comments">
        <h3 className="lscape-detail__section-title">
          댓글 <span className="lscape-detail__count">{comments.length}</span>
        </h3>
        {commentsLoading ? (
          <p className="lscape-detail__hint">댓글 불러오는 중...</p>
        ) : comments.length === 0 ? (
          <p className="lscape-detail__hint">첫 댓글을 남겨보세요</p>
        ) : (
          <ul className="lscape-comments">
            {comments.map((comment) => (
              <li key={comment.id} className="lscape-comments__item">
                <div className="lscape-comments__head">
                  <span className="lscape-comments__author">{comment.authorName}</span>
                  <time className="lscape-comments__date">{formatDate(comment.createdAt)}</time>
                  {!isGuest && user?.id === comment.authorId ? (
                    <button
                      type="button"
                      className="lscape-comments__delete"
                      data-testid={`button-delete-comment-${comment.id}`}
                      onClick={() => deleteCommentMutation.mutate(comment.id)}
                    >
                      삭제
                    </button>
                  ) : null}
                </div>
                <p className="lscape-comments__text">{comment.content}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div
        ref={commentBarRef}
        className="lscape-comment-bar"
        style={keyboardOffset > 0 ? { transform: `translateY(-${keyboardOffset}px)` } : undefined}
      >
        <input
          type="text"
          placeholder="댓글 입력"
          value={commentContent}
          onChange={(e) => setCommentContent(e.target.value)}
          className="lscape-comment-bar__input"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (checkGuest()) return;
              if (!commentContent.trim()) return;
              createCommentMutation.mutate(commentContent.trim());
            }
          }}
        />
        <button
          type="button"
          className="lscape-comment-bar__send"
          disabled={!commentContent.trim() || createCommentMutation.isPending}
          onClick={() => {
            if (checkGuest()) return;
            if (!commentContent.trim()) return;
            createCommentMutation.mutate(commentContent.trim());
          }}
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </button>
      </div>

      {showDeleteConfirm ? (
        <SimpleConfirmPopup
          message="게시글을 삭제하시겠습니까?"
          leftButtonText="삭제"
          rightButtonText="취소"
          onLeftClick={() => deletePostMutation.mutate()}
          onRightClick={() => setShowDeleteConfirm(false)}
        />
      ) : null}

      <GuestRestrictionPopup show={showGuestPopup} onClose={() => setShowGuestPopup(false)} />
    </div>
  );
}
