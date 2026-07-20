import { useEffect, useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { MALL_BASE_PATH } from "@shared/mallConfig";
import MemberOnlyGate from "@/components/mall/MemberOnlyGate";
import { notifyMallCartChanged } from "@/components/mall/MallHeader";
import { resolvePrice } from "@/components/mall/ProductCard";
import {
  addToMallCart,
  clearMallCart,
  formatKrw,
  mallCartTotal,
  readMallCart,
} from "@/lib/mallCart";
import { fetchMemberSessionKind, type MemberSessionKind } from "@/lib/appNavigation";
import { getFullUrl, getOrRefreshAccessToken } from "@/lib/queryClient";
import type { MallCartItem, MallProduct } from "@/lib/mallTypes";

export default function MallCheckoutPage() {
  const searchString = useSearch();
  const buyParams = useMemo(() => new URLSearchParams(searchString), [searchString]);
  const buyProductId = buyParams.get("buy");
  const buyQty = parseInt(buyParams.get("qty") || "1", 10);

  const [items, setItems] = useState<MallCartItem[]>([]);
  const [sessionKind, setSessionKind] = useState<MemberSessionKind>("none");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    void (async () => {
      const kind = await fetchMemberSessionKind();
      setSessionKind(kind);
      if (kind !== "member") return;

      let cart = readMallCart();
      if (buyProductId) {
        const pid = parseInt(buyProductId, 10);
        if (!isNaN(pid)) {
          const res = await fetch(getFullUrl(`/api/homepage/goods/products/${pid}`));
          if (res.ok) {
            const { product } = (await res.json()) as { product: MallProduct };
            const price = resolvePrice(product);
            if (price > 0) {
              addToMallCart(
                {
                  productId: product.id,
                  name: product.name,
                  priceAmount: price,
                  originalPriceAmount: product.originalPriceAmount,
                  imageUrl: product.imageUrl,
                },
                buyQty,
              );
              notifyMallCartChanged();
            }
          }
        }
        cart = readMallCart();
      }
      setItems(cart);

      const token = await getOrRefreshAccessToken();
      if (token) {
        const meRes = await fetch(getFullUrl("/api/users/me"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (meRes.ok) {
          const data = await meRes.json();
          if (data.user?.name) setName(data.user.name);
          if (data.user?.phone) setPhone(data.user.phone);
        }
      }
    })();
  }, [buyProductId, buyQty]);

  const total = mallCartTotal(items);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sessionKind !== "member" || items.length === 0) return;

    setSubmitting(true);
    setError("");
    try {
      const token = await getOrRefreshAccessToken();
      if (!token) {
        setError("게임 앱에서 회원 로그인 후 주문해 주세요.");
        return;
      }

      const res = await fetch(getFullUrl("/api/mall/orders"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          customerName: name.trim(),
          customerPhone: phone.trim(),
          shippingAddress: address.trim(),
          memo: memo.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "주문에 실패했습니다.");
        return;
      }

      clearMallCart();
      notifyMallCartChanged();
      setDone(true);
    } catch {
      setError("주문 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  if (sessionKind === "none" || sessionKind === "guest") {
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <MemberOnlyGate />
      </div>
    );
  }

  if (done) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">주문이 접수되었습니다</h1>
        <p className="text-sm text-neutral-600 mb-8">관리자 확인 후 연락드리겠습니다.</p>
        <Link
          href={MALL_BASE_PATH}
          className="inline-flex h-10 px-6 items-center text-sm font-semibold text-white bg-neutral-900 rounded-md"
        >
          쇼핑 계속하기
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <p className="text-neutral-500 mb-4">주문할 상품이 없습니다.</p>
        <Link href={`${MALL_BASE_PATH}/cart`} className="text-sm text-neutral-900 underline">
          장바구니로
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-neutral-900 mb-6">주문하기</h1>

      <div className="mb-8 p-4 bg-neutral-50 rounded-lg">
        <h2 className="text-sm font-semibold text-neutral-900 mb-3">주문 상품</h2>
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.productId} className="flex justify-between text-sm">
              <span className="text-neutral-700 truncate pr-4">
                {item.name} × {item.quantity}
              </span>
              <span className="font-medium shrink-0">{formatKrw(item.priceAmount * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between mt-4 pt-3 border-t border-neutral-200 font-bold">
          <span>합계</span>
          <span>{formatKrw(total)}</span>
        </div>
        <p className="text-xs text-neutral-500 mt-2">결제: 무통장/관리자 확인 (1차)</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">받는 분</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-10 px-3 border border-neutral-200 rounded-md text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">연락처</label>
          <input
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full h-10 px-3 border border-neutral-200 rounded-md text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">배송지</label>
          <textarea
            required
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-neutral-200 rounded-md text-sm resize-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">요청사항 (선택)</label>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-neutral-200 rounded-md text-sm resize-none"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full h-12 text-sm font-semibold text-white bg-neutral-900 rounded-md hover:bg-neutral-800 disabled:opacity-50"
        >
          {submitting ? "주문 접수 중..." : "주문 접수"}
        </button>
      </form>
    </div>
  );
}
