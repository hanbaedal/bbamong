import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getFullUrl } from "@/lib/queryClient";

interface MallProductInquiryPanelProps {
  productId: number;
  productName: string;
}

interface HomePageInquirySettings {
  shopInquiryEmail?: string;
  shopInquiryPhone?: string;
}

export default function MallProductInquiryPanel({
  productId,
  productName,
}: MallProductInquiryPanelProps) {
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const { data: settings } = useQuery({
    queryKey: ["/api/homepage-settings", "inquiry"],
    queryFn: async () => {
      const res = await fetch(getFullUrl("/api/homepage-settings"));
      if (!res.ok) return {} as HomePageInquirySettings;
      return res.json() as Promise<HomePageInquirySettings>;
    },
    staleTime: 120_000,
  });

  const contactEmail = settings?.shopInquiryEmail?.trim();
  const contactPhone = settings?.shopInquiryPhone?.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !message.trim()) {
      setError("이름과 문의 내용을 입력해 주세요.");
      return;
    }
    if (!phone.trim() && !email.trim()) {
      setError("전화번호 또는 이메일 중 하나는 입력해 주세요.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(getFullUrl("/api/mall/inquiries"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          customerName: customerName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          message: message.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "문의 접수에 실패했습니다.");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "문의 접수에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="border border-neutral-200 rounded-md p-8 text-center">
        <p className="text-sm font-medium text-neutral-900">구매 문의가 접수되었습니다.</p>
        <p className="text-xs text-neutral-500 mt-2">담당자가 확인 후 연락드리겠습니다.</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      {(contactEmail || contactPhone) && (
        <div className="mb-6 p-4 bg-neutral-50 border border-neutral-100 rounded-md text-sm text-neutral-700 space-y-1">
          <p className="font-medium text-neutral-900">고객센터</p>
          {contactPhone && <p>전화: {contactPhone}</p>}
          {contactEmail && <p>이메일: {contactEmail}</p>}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-sm font-semibold text-neutral-900 mb-4">구매 문의 · {productName}</p>
        <input
          type="text"
          placeholder="이름 *"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          className="w-full px-3 py-2 border border-neutral-200 rounded-md text-sm"
        />
        <input
          type="tel"
          placeholder="전화번호"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full px-3 py-2 border border-neutral-200 rounded-md text-sm"
        />
        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 border border-neutral-200 rounded-md text-sm"
        />
        <textarea
          placeholder="문의 내용 (수량, 사이즈 등) *"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          className="w-full px-3 py-2 border border-neutral-200 rounded-md text-sm resize-none"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full h-11 text-sm font-semibold text-white bg-neutral-900 rounded-md hover:bg-neutral-800 disabled:opacity-50"
        >
          {submitting ? "접수 중..." : "구매 문의 보내기"}
        </button>
      </form>
    </div>
  );
}
