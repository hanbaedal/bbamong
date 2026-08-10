import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

type Term = {
  id: number;
  title: string;
  content: string;
};

/** 게임 split 우측 — 긴 문서(Q&A) 스크롤 패널 */
export default function FaqCompact() {
  const { data: terms = [], isLoading } = useQuery<Term[]>({
    queryKey: ["/api/terms", { type: "qna" }],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/terms?type=qna");
      return res.json() as Promise<Term[]>;
    },
    refetchOnMount: "always",
  });

  return (
    <div className="doc-scroll-compact" data-testid="faq-compact">
      <h2 className="doc-scroll-compact__title" data-testid="text-faq-title">
        Q&A
      </h2>
      <div className="doc-scroll-compact__body">
        {isLoading ? (
          <div className="doc-scroll-compact__skeleton">
            {[1, 2, 3].map((i) => (
              <div key={i} className="doc-scroll-compact__skeleton-block" />
            ))}
          </div>
        ) : terms.length > 0 ? (
          <div className="doc-scroll-compact__list">
            {terms.map((term) => (
              <article key={term.id} className="doc-scroll-compact__item" data-testid={`term-${term.id}`}>
                {term.title ? (
                  <h3 className="doc-scroll-compact__item-title">{term.title}</h3>
                ) : null}
                <p className="doc-scroll-compact__text">{term.content}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="doc-scroll-compact__empty">Q&A가 준비 중입니다.</p>
        )}
      </div>
    </div>
  );
}
