import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Minus, Plus, Trash2 } from "lucide-react";
import { MALL_BASE_PATH } from "@shared/mallConfig";
import MemberOnlyGate from "@/components/mall/MemberOnlyGate";
import MallProductImage from "@/components/mall/MallProductImage";
import { notifyMallCartChanged } from "@/components/mall/MallHeader";
import {
  formatKrw,
  mallCartTotal,
  readMallCart,
  removeFromMallCart,
  updateMallCartQuantity,
} from "@/lib/mallCart";
import { fetchMemberSessionKind, type MemberSessionKind } from "@/lib/appNavigation";
import type { MallCartItem } from "@/lib/mallTypes";

export default function MallCartPage() {
  const [items, setItems] = useState<MallCartItem[]>([]);
  const [sessionKind, setSessionKind] = useState<MemberSessionKind>("none");

  const refresh = () => {
    setItems(readMallCart());
    notifyMallCartChanged();
  };

  useEffect(() => {
    refresh();
    void fetchMemberSessionKind().then(setSessionKind);
  }, []);

  const total = mallCartTotal(items);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-neutral-900 mb-6">장바구니</h1>

      {items.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-neutral-500 mb-4">장바구니가 비어 있습니다.</p>
          <Link
            href={MALL_BASE_PATH}
            className="inline-flex h-10 px-4 items-center text-sm font-medium text-white bg-neutral-900 rounded-md"
          >
            쇼핑하러 가기
          </Link>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-neutral-200 border-t border-neutral-200">
            {items.map((item) => (
              <li key={`${item.productId}:${item.color ?? ""}:${item.size ?? ""}`} className="py-4 flex gap-4">
                <div className="w-20 h-24 bg-neutral-100 rounded-sm overflow-hidden shrink-0">
                  {item.imageUrl ? (
                    <MallProductImage
                      src={item.imageUrl}
                      variant="list"
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`${MALL_BASE_PATH}/product/${item.productId}`}
                    className="text-sm font-medium text-neutral-900 line-clamp-2 hover:underline"
                  >
                    {item.name}
                  </Link>
                  {(item.color || item.size) && (
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {[item.color, item.size].filter(Boolean).join(" / ")}
                    </p>
                  )}
                  <p className="text-sm font-semibold text-neutral-900 mt-1">
                    {formatKrw(item.priceAmount)}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex items-center border border-neutral-200 rounded-md">
                      <button
                        type="button"
                        className="p-1.5"
                        onClick={() => {
                          updateMallCartQuantity(item.productId, item.quantity - 1, {
                            color: item.color,
                            size: item.size,
                          });
                          refresh();
                        }}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-8 text-center text-xs">{item.quantity}</span>
                      <button
                        type="button"
                        className="p-1.5"
                        onClick={() => {
                          updateMallCartQuantity(item.productId, item.quantity + 1, {
                            color: item.color,
                            size: item.size,
                          });
                          refresh();
                        }}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      className="p-1.5 text-neutral-400 hover:text-red-600"
                      onClick={() => {
                        removeFromMallCart(item.productId, {
                          color: item.color,
                          size: item.size,
                        });
                        refresh();
                      }}
                      aria-label="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-sm font-semibold text-neutral-900 shrink-0">
                  {formatKrw(item.priceAmount * item.quantity)}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-6 pt-4 border-t border-neutral-200 flex justify-between items-center">
            <span className="text-sm text-neutral-600">합계</span>
            <span className="text-xl font-bold text-neutral-900">{formatKrw(total)}</span>
          </div>

          {sessionKind === "member" ? (
            <Link
              href={`${MALL_BASE_PATH}/checkout`}
              className="mt-6 w-full h-12 flex items-center justify-center text-sm font-semibold text-white bg-neutral-900 rounded-md hover:bg-neutral-800"
            >
              주문하기
            </Link>
          ) : (
            <div className="mt-6 space-y-4">
              <button
                type="button"
                disabled
                className="w-full h-12 text-sm font-semibold text-white bg-neutral-300 rounded-md cursor-not-allowed"
              >
                주문하기 (정회원 전용)
              </button>
              <MemberOnlyGate />
            </div>
          )}
        </>
      )}
    </div>
  );
}
