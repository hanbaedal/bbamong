import { Smartphone } from "lucide-react";
import { MALL_BASE_PATH } from "@shared/mallConfig";
import MallGameButton from "@/components/mall/MallGameButton";

interface MemberOnlyGateProps {
  title?: string;
  description?: string;
}

export default function MemberOnlyGate({
  title = "정회원만 주문할 수 있습니다",
  description = "주문은 PPAMONG 게임 앱에서 회원가입 후 이용해 주세요. 쇼핑몰에서는 상품 둘러보기와 장바구니 담기만 가능합니다.",
}: MemberOnlyGateProps) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 sm:p-6">
      <div className="flex gap-3">
        <Smartphone className="w-6 h-6 text-amber-700 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-amber-950 mb-1">{title}</h3>
          <p className="text-sm text-amber-900/80 leading-relaxed mb-4">{description}</p>
          <div className="flex flex-wrap gap-2">
            <MallGameButton variant="primary" />
            <a
              href={MALL_BASE_PATH}
              className="inline-flex items-center justify-center h-10 px-4 text-sm font-medium text-neutral-700 border border-neutral-300 rounded-md hover:bg-white"
            >
              쇼핑 계속하기
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
