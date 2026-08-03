import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Heart } from "lucide-react";
import { MALL_BASE_PATH } from "@shared/mallConfig";
import MemberOnlyGate from "@/components/mall/MemberOnlyGate";
import ProductCard from "@/components/mall/ProductCard";
import { fetchMemberSessionKind, type MemberSessionKind } from "@/lib/appNavigation";
import { getFullUrl, getOrRefreshAccessToken } from "@/lib/queryClient";
import type { MallProduct } from "@/lib/mallTypes";

export default function MallWishlistPage() {
  const [sessionKind, setSessionKind] = useState<MemberSessionKind>("none");
  const [products, setProducts] = useState<MallProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const token = await getOrRefreshAccessToken();
    if (!token) {
      setProducts([]);
      setLoading(false);
      return;
    }
    const res = await fetch(getFullUrl("/api/mall/wishlist/me"), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      setProducts([]);
      setLoading(false);
      return;
    }
    const data = (await res.json()) as { products: MallProduct[] };
    setProducts(data.products ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void (async () => {
      const kind = await fetchMemberSessionKind();
      setSessionKind(kind);
      if (kind === "member") {
        await load();
      } else {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const onChange = () => {
      if (sessionKind === "member") void load();
    };
    window.addEventListener("ppamong:mall-wishlist", onChange);
    return () => window.removeEventListener("ppamong:mall-wishlist", onChange);
  }, [sessionKind]);

  if (sessionKind === "none" || sessionKind === "guest") {
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <MemberOnlyGate
          title="정회원만 찜 목록을 이용할 수 있습니다"
          description="찜은 PPAMONG 게임 앱에서 회원가입 후 이용해 주세요."
        />
      </div>
    );
  }

  if (loading) {
    return <p className="p-8 text-center text-neutral-500">불러오는 중...</p>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-2 mb-6">
        <Heart className="w-6 h-6 text-red-500" fill="currentColor" />
        <h1 className="text-2xl font-bold text-neutral-900">찜 목록</h1>
        {products.length > 0 && (
          <span className="text-sm text-neutral-500">{products.length}개</span>
        )}
      </div>

      {products.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-neutral-500 mb-4">찜한 상품이 없습니다.</p>
          <Link
            href={MALL_BASE_PATH}
            className="inline-flex h-10 px-4 items-center text-sm font-medium text-white bg-neutral-900 rounded-md"
          >
            쇼핑하러 가기
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
