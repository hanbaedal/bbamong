interface ShopInquirySettings {
  shopInquiryEmail?: string;
  shopInquiryPhone?: string;
}

interface ProductPurchaseInfo {
  name: string;
  purchaseUrl?: string;
}

interface GoodsPurchaseActionsProps {
  product: ProductPurchaseInfo;
  shopSettings?: ShopInquirySettings;
  isPublic?: boolean;
}

export default function GoodsPurchaseActions({
  product,
  shopSettings,
  isPublic = false,
}: GoodsPurchaseActionsProps) {
  const purchaseUrl = product.purchaseUrl?.trim();
  const email = shopSettings?.shopInquiryEmail?.trim();
  const phone = shopSettings?.shopInquiryPhone?.trim();

  const mailto = email
    ? `mailto:${email}?subject=${encodeURIComponent(`[빠몽굿즈] ${product.name} 구매 문의`)}&body=${encodeURIComponent(`상품명: ${product.name}\n\n문의 내용:\n`)}`
    : null;

  const hasPurchase = !!purchaseUrl;
  const hasInquiry = !!mailto || !!phone;

  if (!hasPurchase && !hasInquiry && !isPublic) {
    return (
      <div className="mt-6 pt-4 border-t border-[#333]">
        <button
          type="button"
          onClick={() => {
            window.location.assign("/customer-center");
          }}
          className="w-full py-3 rounded-lg bg-[#CDFF00] text-black font-bold text-sm"
        >
          고객센터 문의
        </button>
      </div>
    );
  }

  if (!hasPurchase && !hasInquiry) {
    return (
      <p className="text-[#666] text-xs mt-6 text-center">
        구매 문의는 관리자에게 연락해 주세요.
      </p>
    );
  }

  return (
    <div className="mt-6 pt-4 border-t border-[#333] flex flex-col gap-2">
      {hasPurchase && (
        <a
          href={purchaseUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-3 rounded-lg bg-[#CDFF00] text-black font-bold text-sm text-center"
        >
          구매하기
        </a>
      )}
      {mailto && (
        <a
          href={mailto}
          className={`w-full py-3 rounded-lg font-bold text-sm text-center ${
            hasPurchase
              ? "border border-[#CDFF00] text-[#CDFF00]"
              : "bg-[#CDFF00] text-black"
          }`}
        >
          구매 문의 (이메일)
        </a>
      )}
      {!mailto && phone && (
        <a
          href={`tel:${phone.replace(/\s/g, "")}`}
          className={`w-full py-3 rounded-lg font-bold text-sm text-center ${
            hasPurchase
              ? "border border-[#CDFF00] text-[#CDFF00]"
              : "bg-[#CDFF00] text-black"
          }`}
        >
          전화 문의
        </a>
      )}
    </div>
  );
}
