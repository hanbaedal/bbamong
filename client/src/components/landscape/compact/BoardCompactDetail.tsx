import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

type BoardPost = {
  id: number;
  title: string;
  content: string;
  createdAt: string;
};

export default function BoardCompactDetail() {
  const params = useParams();
  const postId = params.id;

  const { data: post, isLoading } = useQuery<BoardPost>({
    queryKey: ["/api/posts", postId],
    enabled: !!postId,
    refetchOnMount: "always",
  });

  if (isLoading) {
    return <div className="lscape-detail lscape-detail--loading">불러오는 중...</div>;
  }

  if (!post) {
    return <div className="lscape-detail lscape-detail--empty">게시글을 찾을 수 없습니다</div>;
  }

  return (
    <article className="lscape-detail" data-testid="board-compact-detail">
      <div className="lscape-detail__meta">
        <span className="lscape-detail__chip">빠몽</span>
        <time className="lscape-detail__date" data-testid="post-date">
          {format(new Date(post.createdAt), "yyyy.MM.dd HH:mm")}
        </time>
      </div>
      <h2 className="lscape-detail__title" data-testid="post-title">
        {post.title}
      </h2>
      <div className="lscape-detail__content" data-testid="post-content">
        {post.content}
      </div>
    </article>
  );
}
