import { useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { getNoticeTagClass } from "./noticeUtils";

type Notice = {
  id: number;
  tag: string;
  title: string;
  content: string;
  createdAt: string;
};

export default function NoticeCompactDetail() {
  const queryClient = useQueryClient();
  const params = useParams();
  const noticeId = params.id;

  useEffect(() => {
    if (!noticeId) return;
    void apiRequest("POST", `/api/users/notices/${noticeId}/dismiss`)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/users/notices/banner"] });
      })
      .catch(() => {});
  }, [noticeId, queryClient]);

  const { data: notice, isLoading } = useQuery<Notice>({
    queryKey: ["/api/notices", noticeId],
    enabled: !!noticeId,
    refetchOnMount: "always",
  });

  if (isLoading) {
    return <div className="lscape-detail lscape-detail--loading">불러오는 중...</div>;
  }

  if (!notice) {
    return <div className="lscape-detail lscape-detail--empty">공지를 찾을 수 없습니다</div>;
  }

  return (
    <article className="lscape-detail" data-testid="notice-compact-detail">
      <div className="lscape-detail__meta">
        <span className={getNoticeTagClass(notice.tag)} data-testid="notice-tag">
          {notice.tag}
        </span>
        <time className="lscape-detail__date" data-testid="notice-date">
          {format(new Date(notice.createdAt), "yyyy.MM.dd HH:mm")}
        </time>
      </div>
      <h2 className="lscape-detail__title" data-testid="notice-title">
        {notice.title}
      </h2>
      <div className="lscape-detail__content" data-testid="notice-content">
        {notice.content}
      </div>
    </article>
  );
}
