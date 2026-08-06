import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

type BoardPost = {
  id: number;
  title: string;
  createdAt: string;
};

interface BoardCompactListProps {
  selectedId?: string | null;
  onSelect: (id: number) => void;
}

export default function BoardCompactList({ selectedId, onSelect }: BoardCompactListProps) {
  const { data: posts = [], isLoading } = useQuery<BoardPost[]>({
    queryKey: ["/api/posts"],
    refetchOnMount: "always",
  });

  if (isLoading) {
    return (
      <div className="lscape-list lscape-list--compact">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="lscape-list-item lscape-list-item--skeleton" />
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="lscape-list-empty">
        <p>게시글이 없습니다</p>
      </div>
    );
  }

  return (
    <ul className="lscape-list lscape-list--compact" data-testid="board-compact-list">
      {posts.map((post) => {
        const active = selectedId === String(post.id);
        return (
          <li key={post.id}>
            <button
              type="button"
              data-testid={`post-${post.id}`}
              onClick={() => onSelect(post.id)}
              className={cn("lscape-list-item", active && "lscape-list-item--active")}
            >
              <span className="lscape-list-item__body">
                <span className="lscape-list-item__title" data-testid={`post-title-${post.id}`}>
                  {post.title}
                </span>
                <span className="lscape-list-item__meta" data-testid={`post-date-${post.id}`}>
                  {format(new Date(post.createdAt), "MM.dd HH:mm")}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
