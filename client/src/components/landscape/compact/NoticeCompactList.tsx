import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { getNoticeTagClass } from "./noticeUtils";

type Notice = {
  id: number;
  tag: string;
  title: string;
  createdAt: string;
};

interface NoticeCompactListProps {
  selectedId?: string | null;
  onSelect: (id: number) => void;
}

export default function NoticeCompactList({ selectedId, onSelect }: NoticeCompactListProps) {
  const { data: notices = [], isLoading } = useQuery<Notice[]>({
    queryKey: ["/api/notices"],
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

  if (notices.length === 0) {
    return (
      <div className="lscape-list-empty">
        <p>공지사항이 없습니다</p>
      </div>
    );
  }

  return (
    <ul className="lscape-list lscape-list--compact" data-testid="notice-compact-list">
      {notices.map((notice) => {
        const active = selectedId === String(notice.id);
        return (
          <li key={notice.id}>
            <button
              type="button"
              data-testid={`notice-${notice.id}`}
              onClick={() => onSelect(notice.id)}
              className={cn("lscape-list-item", active && "lscape-list-item--active")}
            >
              <span className={getNoticeTagClass(notice.tag)} data-testid={`notice-tag-${notice.id}`}>
                {notice.tag}
              </span>
              <span className="lscape-list-item__body">
                <span className="lscape-list-item__title" data-testid={`notice-title-${notice.id}`}>
                  {notice.title}
                </span>
                <span className="lscape-list-item__meta" data-testid={`notice-date-${notice.id}`}>
                  {format(new Date(notice.createdAt), "MM.dd HH:mm")}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
