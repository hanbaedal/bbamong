import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Heart, ShoppingBag, Search } from "lucide-react";
import { MALL_BASE_PATH } from "@shared/mallConfig";
import { resolveShopSectionTitle } from "@/lib/shopBranding";
import { readMallCart } from "@/lib/mallCart";
import { useMallWishlist } from "@/hooks/useMallWishlist";
import MallCategoryNav, { resolveMallActiveCategoryId } from "@/components/mall/MallCategoryNav";
import MallGameButton from "@/components/mall/MallGameButton";
import type { MallCategory } from "@/lib/mallTypes";

interface MallHeaderProps {
  categories: MallCategory[];
  mallTitle?: string;
}

export default function MallHeader({ categories, mallTitle }: MallHeaderProps) {
  const [location, setLocation] = useLocation();
  const [cartCount, setCartCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const { productIds: wishlistIds } = useMallWishlist();
  const wishlistCount = wishlistIds.length;

  useEffect(() => {
    const sync = () => {
      const items = readMallCart();
      setCartCount(items.reduce((n, i) => n + i.quantity, 0));
    };
    sync();
    window.addEventListener("ppamong:mall-cart", sync);
    return () => window.removeEventListener("ppamong:mall-cart", sync);
  }, [location]);

  const title = resolveShopSectionTitle(mallTitle);
  const activeCategoryId = resolveMallActiveCategoryId(location, categories);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) {
      setLocation(`${MALL_BASE_PATH}?q=${encodeURIComponent(q)}`);
    } else {
      setLocation(MALL_BASE_PATH);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-neutral-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="h-14 flex items-center gap-4">
          <Link href={MALL_BASE_PATH} className="flex items-center gap-2 shrink-0">
            <span className="text-lg font-bold tracking-tight text-neutral-900">{title}</span>
          </Link>

          <MallCategoryNav
            categories={categories}
            activeCategoryId={activeCategoryId}
            variant="mall"
            layout="desktop"
          />

          <form onSubmit={handleSearch} className="hidden md:flex items-center flex-1 max-w-xs ml-auto">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="상품 검색"
                className="w-full h-9 pl-9 pr-3 text-sm border border-neutral-200 rounded-md bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
              />
            </div>
          </form>

          <div className="flex items-center gap-2 shrink-0 ml-auto md:ml-0">
            <MallGameButton />

            <Link
              href={`${MALL_BASE_PATH}/wishlist`}
              className="relative p-2 text-neutral-700 hover:text-neutral-900"
              aria-label="찜 목록"
            >
              <Heart className="w-5 h-5" />
              {wishlistCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full">
                  {wishlistCount > 99 ? "99+" : wishlistCount}
                </span>
              )}
            </Link>

            <Link
              href={`${MALL_BASE_PATH}/cart`}
              className="relative p-2 text-neutral-700 hover:text-neutral-900"
              aria-label="장바구니"
            >
              <ShoppingBag className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white bg-neutral-900 rounded-full">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        <MallCategoryNav
          categories={categories}
          activeCategoryId={activeCategoryId}
          variant="mall"
          layout="mobile"
        />
      </div>
    </header>
  );
}

export function notifyMallCartChanged(): void {
  window.dispatchEvent(new Event("ppamong:mall-cart"));
}
