import { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, Pencil, ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useInfiniteQuery } from "@tanstack/react-query";
import BottomNavigation from "@/components/BottomNavigation";
import PageHeader from "@/components/PageHeader";
import { useUserAssets } from "@/contexts/UserAssetContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useUser } from "@/contexts/UserContext";
import GuestRestrictionPopup, { useGuestRestriction } from "@/components/customUi/guestRestrictionPopup";

interface PostWithAuthor {
  id: number;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: Date;
  commentCount: number;
  viewCount: number;
}

interface PostsResponse {
  posts: PostWithAuthor[];
  total: number;
  hasMore: boolean;
}

type SearchType = "all" | "author" | "title";

export default function BoardPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchType, setSearchType] = useState<SearchType>("all");
  const [showDropdown, setShowDropdown] = useState(false);
  const [, setLocation] = useLocation();
  const observerTarget = useRef<HTMLDivElement>(null);
  const { assets } = useUserAssets();
  const { toast } = useToast();
  const { isGuest } = useUser();
  const { showGuestPopup, setShowGuestPopup, checkGuest } = useGuestRestriction(isGuest);

  // 게시글 등록 완료 토스트
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("created") === "true") {
      toast({
        description: "게시글을 등록했습니다",
      });
      // URL에서 쿼리 파라미터 제거
      window.history.replaceState({}, "", "/board");
    }
  }, [toast]);

  // 검색어 debouncing (500ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery<PostsResponse>({
      queryKey: ["/api/posts", debouncedSearch, searchType],
      queryFn: async ({ pageParam = 1 }) => {
        const params = new URLSearchParams({
          page: String(pageParam),
          limit: "10",
          searchType: searchType,
        });
        if (debouncedSearch) {
          params.append("search", debouncedSearch);
        }
        const response = await apiRequest("GET", `/api/posts?${params}`);
        return response.json();
      },
      getNextPageParam: (lastPage, allPages) => {
        return lastPage.hasMore ? allPages.length + 1 : undefined;
      },
      initialPageParam: 1,
    });

  // IntersectionObserver로 무한 스크롤 구현
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const formatDate = (date: Date) => {
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${month}.${day} ${hours}:${minutes}`;
  };

  // 모든 페이지의 게시글을 평탄화
  const allPosts = data?.pages.flatMap((page) => page.posts) ?? [];

  const getSearchTypeLabel = (type: SearchType) => {
    switch (type) {
      case "all":
        return "전체";
      case "author":
        return "작성자";
      case "title":
        return "제목";
    }
  };

  return (
    <div className="h-app-screen bg-[#111111]">
      {/* 헤더 */}
      <PageHeader
        leftAction={
          <button
            data-testid="button-back"
            onClick={() => setLocation("/home")}
            className="p-1 focus:outline-none"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        }
      />

      {/* 게시글 리스트 */}
      <div className="overflow-y-scroll-touch scrollbar-hide flex flex-col flex-1 pt-[10px] pb-bottom-nav">
        <h1 data-testid="text-page-title" className="text-white text-[20px] font-bold text-center pt-4 pb-3">게시</h1>
        <div className="px-5 pb-3 flex-shrink-0">

          {/* 드롭다운 & 검색창 */}
          <div className="flex gap-2">
            <div className="relative">
              <button
                data-testid="button-filter-dropdown"
                onClick={() => setShowDropdown(!showDropdown)}
                className="bg-[#1A1A1A] border border-[#373539] rounded-lg px-3 py-2 flex items-center gap-1 text-white text-sm whitespace-nowrap"
              >
                <span>{getSearchTypeLabel(searchType)}</span>
                <ChevronDown className="w-4 h-4" />
              </button>
              {showDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowDropdown(false)}
                  />
                  <div className="absolute top-full mt-1 left-0 bg-[#1A1A1A] border border-[#373539] rounded-lg overflow-hidden z-20 min-w-[80px]">
                    {(["all", "author", "title"] as SearchType[]).map((type) => (
                      <button
                        key={type}
                        data-testid={`filter-option-${type}`}
                        onClick={() => {
                          setSearchType(type);
                          setShowDropdown(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                          searchType === type
                            ? "bg-[#373539] text-white"
                            : "text-[#6B6B6B] hover:bg-[#2A2A2A] hover:text-white"
                        }`}
                      >
                        {getSearchTypeLabel(type)}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6B6B]" />
              <input
                type="text"
                data-testid="input-search-board"
                placeholder="검색어를 입력해 주세요."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-full bg-[#1A1A1A] border border-[#373539] rounded-lg pl-10 pr-3 py-2 text-white text-sm placeholder:text-[#6B6B6B] focus:outline-none focus:border-[#E9E9E9]"
              />
            </div>
          </div>
        </div>
        {isLoading ? (
          <div className="h-full">
            {[1, 2, 3, 4, 5].map((index) => (
              <div
                key={index}
                className="border-b border-[#373539] px-5 py-4 animate-pulse"
              >
                {/* 제목 스켈레톤 */}
                <div className="h-4 bg-[#1A1A1A] rounded w-3/4 mb-3"></div>

                {/* 메타 정보 스켈레톤 */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 bg-[#1A1A1A] rounded w-16"></div>
                    <div className="w-1 h-1 bg-[#1A1A1A] rounded-full"></div>
                    <div className="h-3 bg-[#1A1A1A] rounded w-12"></div>
                  </div>
                  <div className="h-3 bg-[#1A1A1A] rounded w-8"></div>
                </div>
              </div>
            ))}
          </div>
        ) : allPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-4">
            <img
              src={assets.noCommentImg}
              className="w-24 h-24"
              alt="No posts"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            <p className="text-[#6B6B6B] text-sm">
              {searchQuery ? "검색 결과가 없습니다." : "게시글이 없습니다."}
            </p>
          </div>
        ) : (
          <>
            {allPosts.map((post) => (
              <button
                key={post.id}
                data-testid={`post-${post.id}`}
                onClick={() => setLocation(`/board/${post.id}`)}
                className="w-full border-b border-[#373539] px-5 py-4 text-left hover:bg-[#1A1A1A]/50 transition-colors flex justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="text-white text-sm mb-2 truncate">
                    {post.title}
                  </h3>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[#6B6B6B] text-xs">
                      <span>{formatDate(post.createdAt)}</span>
                      <span>·</span>
                      <span>
                        {post.authorName.length > 3
                          ? `${post.authorName.slice(0, 3)}...`
                          : post.authorName}
                      </span>
                      <span>·</span>
                      <span>조회 {post.viewCount}</span>
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0 flex flex-col items-center gap-1 text-white text-xs bg-[#2A2D2E99] rounded-[6px] py-[6px] px-[10px]">
                  댓글{" "}
                  <span>
                    {post.commentCount > 99 ? "99+" : post.commentCount}
                  </span>
                </div>
              </button>
            ))}

            {/* IntersectionObserver 타겟 및 로딩 인디케이터 */}
            <div ref={observerTarget} className="py-4">
              {isFetchingNextPage && (
                <div className="space-y-0">
                  {[1, 2].map((index) => (
                    <div
                      key={index}
                      className="border-b border-[#373539] px-5 py-4 animate-pulse"
                    >
                      <div className="h-4 bg-[#1A1A1A] rounded w-3/4 mb-3"></div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-3 bg-[#1A1A1A] rounded w-16"></div>
                          <div className="w-1 h-1 bg-[#1A1A1A] rounded-full"></div>
                          <div className="h-3 bg-[#1A1A1A] rounded w-12"></div>
                        </div>
                        <div className="h-3 bg-[#1A1A1A] rounded w-8"></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <GuestRestrictionPopup show={showGuestPopup} onClose={() => setShowGuestPopup(false)} />

      {/* 글쓰기 버튼 (FAB) */}
      <button
        data-testid="button-create-post"
        onClick={() => { if (!checkGuest()) setLocation("/board/create"); }}
        className="fixed right-5 bottom-[120px] w-[100px] h-[42px] bg-[#CDFF00] rounded-[48px] flex items-center justify-center py-[10px] shadow-lg hover:bg-[#CDFF00]/90 transition-colors gap-1"
      >
        <img
          src={assets.writingIcon}
          className="w-5 h-5"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
        <span className="whitespace-nowrap">글쓰기</span>
      </button>

      {/* 하단 네비게이션 */}
      <BottomNavigation />
    </div>
  );
}
