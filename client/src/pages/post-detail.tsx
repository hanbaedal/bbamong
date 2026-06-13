import { useState, useEffect, useRef } from "react";
import { ArrowUp, ChevronLeft } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import BottomNavigation from "@/components/BottomNavigation";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useUser } from "@/contexts/UserContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useUserAssets } from "@/contexts/UserAssetContext";
import { Capacitor } from "@capacitor/core";
import GuestRestrictionPopup, { useGuestRestriction } from "@/components/customUi/guestRestrictionPopup";

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
  postId: number;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: Date;
}

export default function PostDetailPage() {
  const params = useParams();
  const postId = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const { user, isGuest } = useUser();
  const [commentContent, setCommentContent] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const { assets } = useUserAssets();
  const { showGuestPopup, setShowGuestPopup, checkGuest } = useGuestRestriction(isGuest);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const commentBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'ios') return;
    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      const offset = window.innerHeight - vv.height;
      setKeyboardOffset(offset > 0 ? offset : 0);
    };

    vv.addEventListener('resize', handleResize);
    vv.addEventListener('scroll', handleResize);
    return () => {
      vv.removeEventListener('resize', handleResize);
      vv.removeEventListener('scroll', handleResize);
    };
  }, []);

  const { data: post, isLoading: postLoading } = useQuery<PostDetail>({
    queryKey: ["/api/posts", postId],
    refetchOnMount: "always",
  });

  const { data: comments = [], isLoading: commentsLoading } = useQuery<
    Comment[]
  >({
    queryKey: ["/api/posts", postId, "comments"],
    refetchOnMount: "always",
  });

  const createCommentMutation = useMutation({
    mutationFn: async (data: { content: string; authorId: string }) => {
      const res = await apiRequest(
        "POST",
        `/api/posts/${postId}/comments`,
        data,
      );
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/posts", postId, "comments"],
      });
      setCommentContent("");
    },
  });

  const handleSubmitComment = () => {
    if (checkGuest()) return;
    if (!commentContent.trim() || !user) return;

    createCommentMutation.mutate({
      content: commentContent.trim(),
      authorId: user.id,
    });
  };

  const formatDate = (date: Date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${year}.${month}.${day} ${hours}:${minutes}`;
  };

  if (postLoading || !post) {
    return (
      <div className="h-app-screen bg-[#111111]">
        {/* 헤더 스켈레톤 */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 bg-[#111111]">
          <div className="w-6 h-6 bg-[#1A1A1A] rounded animate-pulse"></div>
          <div className="h-5 w-24 bg-[#1A1A1A] rounded animate-pulse"></div>
          <div className="w-6"></div>
        </div>

        {/* 게시글 내용 스켈레톤 */}
        <div className="flex-1 overflow-y-scroll-touch bg-[#1c1f20]">
          {/* 제목 및 메타 정보 스켈레톤 */}
          <div className="px-5 py-4 bg-[#111111]">
            <div className="h-5 w-48 bg-[#1A1A1A] rounded mb-2 animate-pulse"></div>
            <div className="h-3 w-40 bg-[#1A1A1A] rounded animate-pulse"></div>
          </div>

          {/* 본문 스켈레톤 */}
          <div className="px-5 py-8 bg-[#111111] space-y-3">
            <div className="h-3.5 w-full bg-[#1A1A1A] rounded animate-pulse"></div>
            <div className="h-3.5 w-5/6 bg-[#1A1A1A] rounded animate-pulse"></div>
            <div className="h-3.5 w-4/5 bg-[#1A1A1A] rounded animate-pulse"></div>
            <div className="h-3.5 w-full bg-[#1A1A1A] rounded animate-pulse"></div>
          </div>

          {/* 댓글 섹션 스켈레톤 */}
          <div className="px-5 py-6 bg-[#111111]">
            <div className="h-4 w-20 bg-[#1A1A1A] rounded mb-4 animate-pulse"></div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="py-3 border-b border-[#373539]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-3 w-16 bg-[#1A1A1A] rounded animate-pulse"></div>
                  <div className="h-3 w-24 bg-[#1A1A1A] rounded animate-pulse"></div>
                </div>
                <div className="h-3.5 w-full bg-[#1A1A1A] rounded animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-app-screen bg-[#111111]">
      {/* 헤더 */}
      <PageHeader
        leftAction={
          <button
            onClick={() => setLocation("/board")}
            data-testid="button-back"
            className="p-1 focus:outline-none"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        }
      />

      {/* 게시글 내용 */}
      <div className="flex-1 overflow-y-scroll-touch bg-[#1c1f20]">
        <h1 data-testid="text-page-title" className="text-white text-[20px] font-bold text-center pt-4 pb-3 bg-[#111111]">게시글상세</h1>
        {/* 제목 및 메타 정보 */}
        <div className="px-5 py-4 bg-[#111111]">
          <h2 className="text-white text-base font-semibold mb-2 break-words">
            {post.title}
          </h2>
          <div className="flex items-center gap-2 text-[#6B6B6B] text-xs">
            <span>
              {formatDate(post.createdAt)} · {post.authorName.length > 8 ? `${post.authorName.slice(0, 8)}...` : post.authorName} · 조회{" "}
              {post.viewCount}
            </span>
          </div>
        </div>

        {/* 본문 */}
        <div className="px-5 py-8 bg-[#111111] min-h-[180px]">
          <p className="text-[#E9E9E9] text-sm whitespace-pre-wrap break-words">
            {post.content}
          </p>
        </div>

        {/* 댓글 섹션 */}
        <div className="px-5 py-4 pb-bottom-nav-with-bar bg-[#1c1f20]">
          <h3 className="text-white text-sm font-semibold mb-4">
            댓글 <span className="text-[#CDFF00]">{comments.length}</span>
          </h3>

          {commentsLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="py-3 border-b border-[#373539]">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-3 w-16 bg-[#1A1A1A] rounded animate-pulse"></div>
                    <div className="h-3 w-24 bg-[#1A1A1A] rounded animate-pulse"></div>
                  </div>
                  <div className="h-3.5 w-full bg-[#1A1A1A] rounded animate-pulse"></div>
                </div>
              ))}
            </div>
          ) : comments.length === 0 ? (
            <>
              <div className="flex justify-center">
                <img
                  src={assets.noCommentImg}
                  className="w-[150px] aspect-square"
                  alt="No comments"
                />
              </div>
              <p className="text-[#6B6B6B] text-xs text-center py-8">
                첫 번째 댓글을 남겨보세요
              </p>
            </>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} data-testid={`comment-${comment.id}`}>
                  <div className="flex flex-col items-start gap-2 mb-1">
                    <span className="text-white text-xs font-medium">
                      {comment.authorName.length > 8 ? `${comment.authorName.slice(0, 8)}...` : comment.authorName}
                    </span>
                    <span className="text-[#6B6B6B] text-[10px]">
                      {formatDate(comment.createdAt)}
                    </span>
                  </div>
                  <p className="text-[#E9E9E9] text-xs leading-relaxed whitespace-pre-wrap break-words">
                    {comment.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 댓글 입력 (하단 고정) */}
      <div
        ref={commentBarRef}
        className={`fixed left-0 right-0 bg-[#111111] border-t border-[#373539] px-5 py-3 z-50 ${keyboardOffset <= 0 ? 'bottom-above-nav' : ''}`}
        style={keyboardOffset > 0 ? { bottom: `${keyboardOffset}px` } : undefined}
      >
        <div className="flex items-center gap-2">
          <input
            type="text"
            data-testid="input-comment"
            placeholder="댓글을 입력해 주세요"
            value={commentContent}
            onChange={(e) => setCommentContent(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && commentContent.trim()) {
                handleSubmitComment();
              }
            }}
            className={`flex-1 bg-[#1A1A1A] text-white text-sm px-4 py-2.5 rounded-lg placeholder:text-[#6B6B6B] focus:outline-none transition-all ${
              isFocused
                ? "border-2 border-[#FDE047]"
                : "border-2 border-transparent"
            }`}
          />
          <button
            data-testid="button-submit-comment"
            onClick={handleSubmitComment}
            disabled={!commentContent.trim() || createCommentMutation.isPending}
            className={`p-2.5 rounded-lg transition-all disabled:opacity-50 ${
              commentContent.trim()
                ? "bg-[#FDE047] text-black"
                : "bg-[#2A2A2A] text-[#6B6B6B]"
            }`}
          >
            <ArrowUp className="w-5 h-5" />
          </button>
        </div>
      </div>
      <GuestRestrictionPopup show={showGuestPopup} onClose={() => setShowGuestPopup(false)} />
      <BottomNavigation />
    </div>
  );
}
