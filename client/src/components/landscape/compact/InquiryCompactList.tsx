import { useState } from "react";
import { format } from "date-fns";
import { PenLine } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@/contexts/UserContext";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import GuestRestrictionPopup, { useGuestRestriction } from "@/components/customUi/guestRestrictionPopup";
import { getInquiryStatusClass, getInquiryStatusLabel } from "./noticeUtils";

type Inquiry = {
  id: number;
  category: string;
  title: string;
  status: string;
  createdAt: string;
};

interface InquiryCompactListProps {
  selectedId?: string | null;
  onSelect: (id: number) => void;
  onCreate: () => void;
}

export default function InquiryCompactList({
  selectedId,
  onSelect,
  onCreate,
}: InquiryCompactListProps) {
  const [activeTab, setActiveTab] = useState<"inquiry" | "answered">("inquiry");
  const { user, isGuest } = useUser();
  const { showGuestPopup, setShowGuestPopup, checkGuest } = useGuestRestriction(isGuest);

  const { data: allInquiries = [], isLoading } = useQuery<Inquiry[]>({
    queryKey: ["/api/inquiries"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/inquiries");
      return (await res.json()) as Inquiry[];
    },
    enabled: !!user?.id && !isGuest,
    refetchOnMount: "always",
    staleTime: 0,
  });

  const inquiries =
    activeTab === "answered"
      ? allInquiries.filter((inquiry) => inquiry.status === "resolved")
      : allInquiries;

  return (
    <div className="lscape-list-panel">
      <div className="lscape-tabs">
        <button
          type="button"
          data-testid="tab-inquiry"
          className={cn("lscape-tabs__btn", activeTab === "inquiry" && "lscape-tabs__btn--active")}
          onClick={() => setActiveTab("inquiry")}
        >
          문의
        </button>
        <button
          type="button"
          data-testid="tab-answered"
          className={cn("lscape-tabs__btn", activeTab === "answered" && "lscape-tabs__btn--active")}
          onClick={() => setActiveTab("answered")}
        >
          답변
        </button>
      </div>

      {isLoading ? (
        <div className="lscape-list lscape-list--compact">
          {[1, 2, 3].map((i) => (
            <div key={i} className="lscape-list-item lscape-list-item--skeleton" />
          ))}
        </div>
      ) : inquiries.length === 0 ? (
        <div className="lscape-list-empty">
          <p>{activeTab === "inquiry" ? "문의 내역이 없습니다" : "답변 받은 문의가 없습니다"}</p>
          {activeTab === "inquiry" ? (
            <p className="lscape-list-empty__hint">아래 「문의하기」로 새 문의를 남겨보세요</p>
          ) : null}
        </div>
      ) : (
        <ul className="lscape-list lscape-list--compact">
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
                  <span className={getInquiryStatusClass(inquiry.status)} data-testid={`inquiry-status-${inquiry.id}`}>
                    {getInquiryStatusLabel(inquiry.status)}
                  </span>
                  <span className="lscape-list-item__body">
                    <span className="lscape-list-item__title" data-testid={`inquiry-title-${inquiry.id}`}>
                      {inquiry.title}
                    </span>
                    <span className="lscape-list-item__meta">
                      <span data-testid={`inquiry-category-${inquiry.id}`}>{inquiry.category}</span>
                      <span className="lscape-list-item__dot">·</span>
                      <span data-testid={`inquiry-date-${inquiry.id}`}>
                        {format(new Date(inquiry.createdAt), "MM.dd HH:mm")}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {activeTab === "inquiry" ? (
        <button
          type="button"
          data-testid="button-inquiry"
          className="lscape-fab"
          onClick={() => {
            if (!checkGuest()) onCreate();
          }}
        >
          <PenLine className="h-3.5 w-3.5" aria-hidden />
          문의하기
        </button>
      ) : null}

      <GuestRestrictionPopup show={showGuestPopup} onClose={() => setShowGuestPopup(false)} />
    </div>
  );
}
