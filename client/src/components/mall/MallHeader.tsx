import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ShoppingBag, Search, Gamepad2 } from "lucide-react";
import { MALL_BASE_PATH } from "@shared/mallConfig";
import { resolveShopSectionTitle } from "@/lib/shopBranding";
import { readMallCart } from "@/lib/mallCart";
import { fetchMemberSessionKind, navigateToGame, type MemberSessionKind } from "@/lib/appNavigation";
import { buildUserLoginUrl } from "@/lib/shopRoutes";
import type { MallCategory } from "@/lib/mallTypes";

interface MallHeaderProps {
  categories: MallCategory[];
  mallTitle?: string;
}

export default function MallHeader({ categories, mallTitle }: MallHeaderProps) {
  const [location, setLocation] = useLocation();
  const [cartCount, setCartCount] = useState(0);
  const [sessionKind, setSessionKind] = useState<MemberSessionKind>("none");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const sync = () => {
      const items = readMallCart();
      setCartCount(items.reduce((n, i) => n + i.quantity, 0));
    };
    sync();
    window.addEventListener("ppamong:mall-cart", sync);
    return () => window.removeEventListener("ppamong:mall-cart", sync);
  }, [location]);

  useEffect(() => {
    void fetchMemberSessionKind().then(setSessionKind);
  }, [location]);

  const title = resolveShopSectionTitle(mallTitle);
  const base = location.split("?")[0];

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

          <nav className="hidden lg:flex items-center gap-1 flex-1 overflow-x-auto">
            <Link
              href={MALL_BASE_PATH}
              className={`px-3 py-2 text-sm whitespace-nowrap rounded-md ${
                base === MALL_BASE_PATH ? "font-semibold text-neutral-900 bg-neutral-100" : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              전체
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`${MALL_BASE_PATH}/category/${cat.id}`}
                className={`px-3 py-2 text-sm whitespace-nowrap rounded-md ${
                  base === `${MALL_BASE_PATH}/category/${cat.id}`
                    ? "font-semibold text-neutral-900 bg-neutral-100"
                    : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                {cat.name}
              </Link>
            ))}
          </nav>

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

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigateToGame()}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-sm text-neutral-600 hover:text-neutral-900"
              title="게임으로"
            >
              <Gamepad2 className="w-4 h-4" />
              게임
            </button>

            {sessionKind === "member" ? (
              <span className="text-xs text-neutral-500 hidden sm:inline">회원</span>
            ) : (
              <a
                href={buildUserLoginUrl(window.location.pathname + window.location.search, { allowGuest: false })}
                className="text-sm font-medium text-neutral-900 hover:underline"
              >
                로그인
              </a>
            )}

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

        <div className="lg:hidden pb-2 flex gap-2 overflow-x-auto">
          <Link
            href={MALL_BASE_PATH}
            className="px-3 py-1.5 text-xs whitespace-nowrap rounded-full border border-neutral-200"
          >
            전체
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`${MALL_BASE_PATH}/category/${cat.id}`}
              className="px-3 py-1.5 text-xs whitespace-nowrap rounded-full border border-neutral-200"
            >
              {cat.name}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}

export function notifyMallCartChanged(): void {
  window.dispatchEvent(new Event("ppamong:mall-cart"));
}
