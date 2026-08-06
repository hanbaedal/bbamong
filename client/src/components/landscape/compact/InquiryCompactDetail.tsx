import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

type InquiryDetail = {
  id: number;
  category: string;
  title: string;
  content: string;
  response?: string | null;
  createdAt: string;
};

export default function InquiryCompactDetail() {
  const params = useParams();
  const inquiryId = params.id;

  const { data: inquiry, isLoading } = useQuery<InquiryDetail>({
    queryKey: ["/api/inquiries", inquiryId],
    enabled: !!inquiryId,
    refetchOnMount: "always",
  });

  if (isLoading) {
    return <div className="lscape-detail lscape-detail--loading">불러오는 중...</div>;
  }

  if (!inquiry) {
    return <div className="lscape-detail lscape-detail--empty">문의를 찾을 수 없습니다</div>;
  }

  return (
    <article className="lscape-detail" data-testid="inquiry-compact-detail">
      <div className="lscape-detail__meta">
        <span className="lscape-detail__chip" data-testid="inquiry-category">
          {inquiry.category}
        </span>
        <time className="lscape-detail__date" data-testid="inquiry-date">
          {format(new Date(inquiry.createdAt), "yyyy.MM.dd HH:mm")}
        </time>
      </div>
      <h2 className="lscape-detail__title" data-testid="inquiry-title">
        {inquiry.title}
      </h2>
      <div className="lscape-detail__content" data-testid="inquiry-content">
        {inquiry.content}
      </div>

      {inquiry.response ? (
        <section className="lscape-detail__section">
          <h3 className="lscape-detail__section-title">답변</h3>
          <div className="lscape-detail__reply" data-testid="inquiry-response">
            {inquiry.response}
          </div>
        </section>
      ) : null}
    </article>
  );
}
