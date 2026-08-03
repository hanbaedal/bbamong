import MallProductImage from "@/components/mall/MallProductImage";
import type { MallProduct } from "@/lib/mallTypes";

interface MallProductInfoPanelProps {
  product: MallProduct;
}

export default function MallProductInfoPanel({ product }: MallProductInfoPanelProps) {
  const hasDetailImages = product.detailImages && product.detailImages.length > 0;
  const detailText = product.detailContent?.trim();

  return (
    <div className="space-y-6">
      {detailText && !hasDetailImages && (
        <div className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">
          {detailText}
        </div>
      )}

      {hasDetailImages ? (
        <div className="space-y-0">
          {product.detailImages!.map((url, index) => (
            <MallProductImage
              key={`${url}-${index}`}
              src={url}
              variant="detail"
              alt={`${product.name} 상품정보 ${index + 1}`}
              className="w-full block"
              loading="lazy"
            />
          ))}
        </div>
      ) : null}

      {detailText && hasDetailImages && (
        <div className="border-t border-neutral-200 pt-6 text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">
          {detailText}
        </div>
      )}

      {!hasDetailImages && !detailText && (
        <p className="text-sm text-neutral-500 py-8 text-center">
          등록된 상품정보가 없습니다. 관리자에서 상품정보 이미지 또는 상세 설명을 등록해 주세요.
        </p>
      )}
    </div>
  );
}
