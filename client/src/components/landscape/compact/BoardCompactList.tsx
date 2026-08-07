import { useEffect, useRef, useState } from "react";
import { Search, ChevronDown, PenLine } from "lucide-react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useUser } from "@/contexts/UserContext";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import GuestRestrictionPopup, { useGuestRestriction } from "@/components/customUi/guestRestrictionPopup";

interface PostWithAuthor {
  id: number;
  title: string;
  authorName: string;
  createdAt: Date;
  commentCount: number;
  viewCount: number;
}

interface PostsResponse {
  posts: PostWithAuthor[];
  hasMore: boolean;
}

type SearchType = "all" | "author" | "title";

interface BoardCompactListProps {
  selectedId?: string | null;
  onSelect: (id: number) => void;
  onCreate: () => void;
}

const searchLabels: Record<SearchType, string> = {
  all: "전체",
  author: "작성자",
  title: "제목",
};

export default function BoardCompactList({ selectedId, onSelect, onCreate }: BoardCompactListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchType, setSearchType] = useState<SearchType>("all");
  const [showDropdown, setShowDropdown] = useState(false);
  const observerTarget = useRef<HTMLLIElement>(null);
  const { isGuest } = useUser();
  const { showGuestPopup, setShowGuestPopup, checkGuest } = useGuestRestriction(isGuest);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery<PostsResponse>({
      queryKey: ["/api/posts", debouncedSearch, searchType],
      queryFn: async ({ pageParam = 1 }) => {
        const params = new URLSearchParams({
          page: String(pageParam),
          limit: "12",
          searchType,
        });
        if (debouncedSearch) params.append("search", debouncedSearch);
        const response = await apiRequest("GET", `/api/posts?${params}`);
        return response.json();
      },
      getNextPageParam: (lastPage, allPages) => (lastPage.hasMore ? allPages.length + 1 : undefined),
      initialPageParam: 1,
    });

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );
    const target = observerTarget.current;
    if (target) observer.observe(target);
    return () => {
      if (target) observer.unobserve(target);
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const allPosts = data?.pages.flatMap((page) => page.posts) ?? [];

  const formatDate = (date: Date) => {
    const d = new Date(date);
    return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <div className="lscape-list-panel">
      <div className="lscape-search">
        <div className="lscape-search__filter">
          <button
            type="button"
            data-testid="button-filter-dropdown"
            className="lscape-search__filter-btn"
            onClick={() => setShowDropdown((v) => !v)}
          >
            <span>{searchLabels[searchType]}</span>
            <ChevronDown className="h-3 w-3 opacity-70" />
          </button>
          {showDropdown ? (
            <>
              <button
                type="button"
                className="lscape-search__backdrop"
                aria-label="닫기"
                onClick={() => setShowDropdown(false)}
              />
              <div className="lscape-search__menu">
                {(["all", "author", "title"] as SearchType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    data-testid={`filter-option-${type}`}
                    className={cn(
                      "lscape-search__menu-item",
                      searchType === type && "lscape-search__menu-item--active",
                    )}
                    onClick={() => {
                      setSearchType(type);
                      setShowDropdown(false);
                    }}
                  >
                    {searchLabels[type]}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
        <div className="lscape-search__input-wrap">
          <Search className="lscape-search__icon" aria-hidden />
          <input
            type="search"
            data-testid="input-search-board"
            placeholder="검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="lscape-search__input"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="lscape-list lscape-list--compact lscape-list--board">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="lscape-list-item lscape-list-item--skeleton" />
          ))}
        </div>
      ) : allPosts.length === 0 ? (
        <div className="lscape-list-empty">
          <p>{searchQuery ? "검색 결과가 없습니다" : "게시글이 없습니다"}</p>
        </div>
      ) : (
        <ul className="lscape-list lscape-list--compact lscape-list--board">
          {allPosts.map((post) => {
            const active = selectedId === String(post.id);
            return (
              <li key={post.id}>
                <button
                  type="button"
                  data-testid={`post-${post.id}`}
                  onClick={() => onSelect(post.id)}
                  className={cn("lscape-list-item lscape-list-item--row", active && "lscape-list-item--active")}
                >
                  <span className="lscape-list-item__body">
                    <span className="lscape-list-item__title">{post.title}</span>
                    <span className="lscape-list-item__meta">
                      {formatDate(post.createdAt)} · {post.authorName.slice(0, 4)}
                      {post.authorName.length > 4 ? "…" : ""} · 조회 {post.viewCount}
                    </span>
                  </span>
                  <span className="lscape-list-item__badge">
                    {post.commentCount > 99 ? "99+" : post.commentCount}
                  </span>
                </button>
              </li>
            );
          })}
          <li ref={observerTarget} className="lscape-list-sentinel" aria-hidden />
        </ul>
      )}

      <button
        type="button"
        data-testid="button-create-post"
        className="lscape-fab"
        onClick={() => {
          if (!checkGuest()) onCreate();
        }}
      >
        <PenLine className="h-3.5 w-3.5" aria-hidden />
        글쓰기
      </button>

      <GuestRestrictionPopup show={showGuestPopup} onClose={() => setShowGuestPopup(false)} />
    </div>
  );
}
