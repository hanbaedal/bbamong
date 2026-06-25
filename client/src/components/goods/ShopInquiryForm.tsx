import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";

interface ShopInquiryFormProps {
  productId: number;
  productName: string;
}

export default function ShopInquiryForm({ productId, productName }: ShopInquiryFormProps) {
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

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
      const res = await apiRequest("POST", "/api/shop/inquiries", {
        productId,
        customerName: customerName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        message: message.trim(),
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
      <div className="mt-6 p-4 rounded-lg bg-[#1A1A1A] border border-[#333] text-center">
        <p className="text-[#CDFF00] text-sm font-medium">구매 문의가 접수되었습니다.</p>
        <p className="text-[#888] text-xs mt-2">담당자가 확인 후 연락드리겠습니다.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 pt-4 border-t border-[#333] space-y-3">
      <p className="text-white text-sm font-medium">구매 문의 · {productName}</p>
      <input
        type="text"
        placeholder="이름 *"
        value={customerName}
        onChange={(e) => setCustomerName(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-[#1A1A1A] border border-[#333] text-white text-sm"
      />
      <input
        type="tel"
        placeholder="전화번호"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-[#1A1A1A] border border-[#333] text-white text-sm"
      />
      <input
        type="email"
        placeholder="이메일"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-[#1A1A1A] border border-[#333] text-white text-sm"
      />
      <textarea
        placeholder="문의 내용 (수량, 사이즈 등) *"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        className="w-full px-3 py-2 rounded-lg bg-[#1A1A1A] border border-[#333] text-white text-sm resize-none"
      />
      {error && <p className="text-[#E11936] text-xs">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 rounded-lg bg-[#CDFF00] text-black font-bold text-sm disabled:opacity-50"
      >
        {submitting ? "접수 중..." : "구매 문의 보내기"}
      </button>
    </form>
  );
}
