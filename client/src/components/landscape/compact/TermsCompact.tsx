import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

type Term = {
  id: number;
  title: string;
  content: string;
};

/** 게임 split 우측 — 이용약관 스크롤 패널 */
export default function TermsCompact() {
  const { data: terms = [], isLoading } = useQuery<Term[]>({
    queryKey: ["/api/terms", { type: "service" }],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/terms?type=service");
      return res.json() as Promise<Term[]>;
    },
    refetchOnMount: "always",
  });

  return (
    <div className="doc-scroll-compact" data-testid="terms-compact">
      <h2 className="doc-scroll-compact__title" data-testid="text-terms-title">
        서비스 이용약관
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
          <p className="doc-scroll-compact__empty">이용약관이 준비 중입니다.</p>
        )}
      </div>
    </div>
  );
}
