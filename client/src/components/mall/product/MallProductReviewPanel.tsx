import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getFullUrl } from "@/lib/queryClient";
import type { MallProductReviewSummary } from "@/lib/mallTypes";
import { StarRating, StarRatingInput } from "./StarRating";

interface MallProductReviewPanelProps {
  productId: number;
}

export default function MallProductReviewPanel({ productId }: MallProductReviewPanelProps) {
  const queryClient = useQueryClient();
  const [authorName, setAuthorName] = useState("");
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/mall/products", productId, "reviews"],
    queryFn: async () => {
      const res = await fetch(getFullUrl(`/api/mall/products/${productId}/reviews`));
      if (!res.ok) throw new Error("failed");
      return res.json() as Promise<MallProductReviewSummary>;
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(getFullUrl(`/api/mall/products/${productId}/reviews`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorName: authorName.trim(), rating, content: content.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "리뷰 등록에 실패했습니다.");
      return body;
    },
    onSuccess: () => {
      setAuthorName("");
      setRating(5);
      setContent("");
      setError("");
      void queryClient.invalidateQueries({ queryKey: ["/api/mall/products", productId, "reviews"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!authorName.trim() || !content.trim()) {
      setError("이름과 리뷰 내용을 입력해 주세요.");
      return;
    }
    submitMutation.mutate();
  };

  if (isLoading) {
    return <p className="text-sm text-neutral-500 py-8 text-center">리뷰를 불러오는 중...</p>;
  }

  const reviews = data?.reviews ?? [];
  const totalCount = data?.totalCount ?? 0;
  const averageRating = data?.averageRating ?? 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4 pb-6 border-b border-neutral-200">
        <div>
          <p className="text-3xl font-bold text-neutral-900">{averageRating.toFixed(1)}</p>
          <StarRating rating={Math.round(averageRating)} size="md" className="mt-1" />
        </div>
        <p className="text-sm text-neutral-600">리뷰 {totalCount}건</p>
      </div>

      {reviews.length === 0 ? (
        <p className="text-sm text-neutral-500 py-4 text-center">아직 등록된 리뷰가 없습니다.</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {reviews.map((review) => (
            <li key={review.id} className="py-5 first:pt-0">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-neutral-900">{review.authorName}</span>
                  <StarRating rating={review.rating} />
                </div>
                <time className="text-xs text-neutral-400">
                  {new Date(review.createdAt).toLocaleDateString("ko-KR")}
                </time>
              </div>
              <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">
                {review.content}
              </p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="border border-neutral-200 rounded-md p-5 space-y-4">
        <h3 className="text-sm font-semibold text-neutral-900">리뷰 작성</h3>
        <input
          type="text"
          placeholder="이름 *"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          className="w-full px-3 py-2 border border-neutral-200 rounded-md text-sm"
        />
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-600">별점</span>
          <StarRatingInput value={rating} onChange={setRating} />
        </div>
        <textarea
          placeholder="리뷰 내용 *"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-neutral-200 rounded-md text-sm resize-none"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        {submitMutation.isSuccess && (
          <p className="text-xs text-green-700">리뷰가 등록되었습니다.</p>
        )}
        <button
          type="submit"
          disabled={submitMutation.isPending}
          className="h-10 px-6 text-sm font-semibold text-white bg-neutral-900 rounded-md hover:bg-neutral-800 disabled:opacity-50"
        >
          {submitMutation.isPending ? "등록 중..." : "리뷰 등록"}
        </button>
      </form>
    </div>
  );
}
