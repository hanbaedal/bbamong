import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

type InquiryItem = {
  id: number;
  category: string;
  title: string;
  createdAt: string;
};

interface InquiryCompactListProps {
  selectedId?: string | null;
  onSelect: (id: number) => void;
}

export default function InquiryCompactList({ selectedId, onSelect }: InquiryCompactListProps) {
  const { data: inquiries = [], isLoading } = useQuery<InquiryItem[]>({
    queryKey: ["/api/inquiries"],
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

  if (inquiries.length === 0) {
    return (
      <div className="lscape-list-empty">
        <p>문의 안내가 없습니다</p>
      </div>
    );
  }

  return (
    <ul className="lscape-list lscape-list--compact" data-testid="inquiry-compact-list">
      {inquiries.map((inquiry) => {
        const active = selectedId === String(inquiry.id);
        return (
          <li key={inquiry.id}>
            <button
              type="button"
              data-testid={`inquiry-${inquiry.id}`}
              onClick={() => onSelect(inquiry.id)}
              className={cn("lscape-list-item", active && "lscape-list-item--active")}
            >
              <span className="lscape-detail__chip">{inquiry.category}</span>
              <span className="lscape-list-item__body">
                <span className="lscape-list-item__title" data-testid={`inquiry-title-${inquiry.id}`}>
                  {inquiry.title}
                </span>
                <span className="lscape-list-item__meta" data-testid={`inquiry-date-${inquiry.id}`}>
                  {format(new Date(inquiry.createdAt), "MM.dd HH:mm")}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
