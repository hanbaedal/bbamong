import { useMemo, useRef, useState } from "react";
import {
  calculateDiscountedPrice,
  MALL_DEFAULT_SHIPPING_LABEL,
  MALL_DEFAULT_PROCURE_NOTICE,
  MALL_FULFILLMENT_OPTIONS,
  MALL_PRODUCT_DETAIL_IMAGE_MAX,
  MALL_PRODUCT_VARIANT_MAX,
  type MallFulfillmentType,
  type MallProductVariant,
} from "@shared/mallProduct";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MallProductImageUpload, { uploadMallProductImageFile } from "@/components/admin/MallProductImageUpload";
import { formatKrw } from "@/lib/mallCart";
import { Loader2 } from "lucide-react";

export interface MallProductFormValues {
  id?: number;
  categoryId: number;
  name: string;
  brand: string;
  color: string;
  size: string;
  summary: string;
  originalPriceAmount: number;
  discountPercent: number;
  priceAmount: number;
  shippingLabel: string;
  stockQuantity: number;
  variants: MallProductVariant[];
  fulfillmentType: MallFulfillmentType;
  procureNotice: string;
  imageUrl: string;
  detailImages: string[];
  isActive: boolean;
}

interface GoodsCategoryOption {
  id: number;
  name: string;
}

interface MallProductFormProps {
  categories: GoodsCategoryOption[];
  value: Partial<MallProductFormValues>;
  onChange: (next: Partial<MallProductFormValues>) => void;
  onSave: () => void;
  onCancel: () => void;
  saving?: boolean;
}

export function createEmptyMallProduct(categoryId?: number): Partial<MallProductFormValues> {
  return {
    categoryId: categoryId ?? 0,
    name: "",
    brand: "",
    color: "",
    size: "",
    summary: "",
    originalPriceAmount: 0,
    discountPercent: 0,
    priceAmount: 0,
    shippingLabel: MALL_DEFAULT_SHIPPING_LABEL,
    stockQuantity: -1,
    variants: [],
    fulfillmentType: "stock",
    procureNotice: MALL_DEFAULT_PROCURE_NOTICE,
    imageUrl: "",
    detailImages: [],
    isActive: true,
  };
}

export default function MallProductForm({
  categories,
  value,
  onChange,
  onSave,
  onCancel,
  saving = false,
}: MallProductFormProps) {
  const detailInputRef = useRef<HTMLInputElement>(null);
  const [detailUploading, setDetailUploading] = useState(false);
  const discountedPrice = useMemo(
    () =>
      calculateDiscountedPrice(value.originalPriceAmount ?? 0, value.discountPercent ?? 0),
    [value.originalPriceAmount, value.discountPercent],
  );

  const setDiscountFields = (patch: Partial<MallProductFormValues>) => {
    const next = { ...value, ...patch };
    const priceAmount = calculateDiscountedPrice(
      next.originalPriceAmount ?? 0,
      next.discountPercent ?? 0,
    );
    onChange({ ...next, priceAmount });
  };

  const detailImages = value.detailImages ?? [];
  const variants = value.variants ?? [];
  const hasVariants = variants.length > 0;
  const isProcure = value.fulfillmentType === "procure";

  const updateVariant = (index: number, patch: Partial<MallProductVariant>) => {
    const next = variants.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange({ ...value, variants: next });
  };

  return (
    <div className="border border-[#E9E9E9] rounded-lg p-4 space-y-4 bg-[#FAFAFA]">
      <h3 className="font-medium">{value.id ? "상품 수정" : "상품 등록"}</h3>

      <div className="space-y-2">
        <Label>판매 유형</Label>
        <Select
          value={value.fulfillmentType ?? "stock"}
          onValueChange={(v) =>
            onChange({
              ...value,
              fulfillmentType: v as MallFulfillmentType,
              procureNotice:
                v === "procure"
                  ? value.procureNotice || MALL_DEFAULT_PROCURE_NOTICE
                  : value.procureNotice,
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MALL_FULFILLMENT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-[#888]">
          {MALL_FULFILLMENT_OPTIONS.find((o) => o.value === (value.fulfillmentType ?? "stock"))?.description}
        </p>
      </div>

      {isProcure ? (
        <div className="space-y-2">
          <Label>주문후조달 안내 문구</Label>
          <Textarea
            value={value.procureNotice ?? MALL_DEFAULT_PROCURE_NOTICE}
            onChange={(e) => onChange({ ...value, procureNotice: e.target.value })}
            rows={2}
          />
        </div>
      ) : null}

      <div className="space-y-2">
        <Label>카테고리</Label>
        <Select
          value={String(value.categoryId || "")}
          onValueChange={(v) => onChange({ ...value, categoryId: parseInt(v, 10) })}
        >
          <SelectTrigger>
            <SelectValue placeholder="카테고리 선택" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>제품명칭</Label>
          <Input
            placeholder="예: TESLA"
            value={value.name ?? ""}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>브랜드</Label>
          <Input
            placeholder="예: PPAMONG"
            value={value.brand ?? ""}
            onChange={(e) => onChange({ ...value, brand: e.target.value })}
          />
        </div>
        {!hasVariants && !isProcure ? (
          <>
            <div className="space-y-2">
              <Label>컬러 (표시용)</Label>
              <Input
                placeholder="예: 블랙"
                value={value.color ?? ""}
                onChange={(e) => onChange({ ...value, color: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>사이즈 (표시용)</Label>
              <Input
                placeholder="예: M, L, FREE"
                value={value.size ?? ""}
                onChange={(e) => onChange({ ...value, size: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>재고 (단일)</Label>
              <Input
                type="number"
                min={-1}
                placeholder="-1 = 무제한"
                value={value.stockQuantity ?? -1}
                onChange={(e) =>
                  onChange({ ...value, stockQuantity: parseInt(e.target.value, 10) || -1 })
                }
              />
              <p className="text-xs text-[#888]">-1이면 재고 제한 없음, 0이면 품절</p>
            </div>
          </>
        ) : null}
        <div className="space-y-2">
          <Label>배송</Label>
          <Input
            placeholder={MALL_DEFAULT_SHIPPING_LABEL}
            value={value.shippingLabel ?? MALL_DEFAULT_SHIPPING_LABEL}
            onChange={(e) => onChange({ ...value, shippingLabel: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-3 border border-[#E9E9E9] rounded-lg p-3 bg-white">
        <div className="flex items-center justify-between gap-2">
          <div>
            <Label>옵션별 재고 (컬러 · 사이즈)</Label>
            <p className="text-xs text-[#888] mt-1">
              {isProcure
                ? "주문후조달 상품은 재고를 표시하지 않습니다. (발주·입고는 구매·재고 관리에서 처리)"
                : "등록 시 몰에서 컬러·사이즈를 선택하고 재고를 확인할 수 있습니다."}
            </p>
          </div>
          {!isProcure && variants.length < MALL_PRODUCT_VARIANT_MAX ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({
                  ...value,
                  variants: [...variants, { color: "", size: "", stock: 0 }],
                })
              }
            >
              옵션 추가
            </Button>
          ) : null}
        </div>
        {variants.length > 0 && !isProcure ? (
          <div className="space-y-2">
            {variants.map((row, index) => (
              <div key={index} className="grid grid-cols-[1fr_1fr_100px_auto] gap-2 items-center">
                <Input
                  placeholder="컬러"
                  value={row.color}
                  onChange={(e) => updateVariant(index, { color: e.target.value })}
                />
                <Input
                  placeholder="사이즈"
                  value={row.size}
                  onChange={(e) => updateVariant(index, { size: e.target.value })}
                />
                <Input
                  type="number"
                  min={0}
                  placeholder="재고"
                  value={row.stock}
                  onChange={(e) =>
                    updateVariant(index, { stock: parseInt(e.target.value, 10) || 0 })
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    onChange({
                      ...value,
                      variants: variants.filter((_, i) => i !== index),
                    })
                  }
                >
                  삭제
                </Button>
              </div>
            ))}
          </div>
        ) : !isProcure ? (
          <p className="text-xs text-[#888]">옵션이 없으면 위의 컬러·사이즈·단일 재고를 사용합니다.</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label>제품설명</Label>
        <Textarea
          placeholder="예: 테니스 스커트 속바지 트레이닝 플리츠 치마"
          value={value.summary ?? ""}
          onChange={(e) => onChange({ ...value, summary: e.target.value })}
          rows={3}
        />
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label>판매가격 (원)</Label>
          <Input
            type="number"
            min={0}
            value={value.originalPriceAmount ?? 0}
            onChange={(e) =>
              setDiscountFields({
                originalPriceAmount: parseInt(e.target.value, 10) || 0,
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label>할인율 (%)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={value.discountPercent ?? 0}
            onChange={(e) =>
              setDiscountFields({
                discountPercent: parseInt(e.target.value, 10) || 0,
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label>할인가격 (자동)</Label>
          <Input
            readOnly
            value={discountedPrice > 0 ? formatKrw(discountedPrice) : ""}
            className="bg-[#F5F5F5]"
          />
        </div>
      </div>

      <MallProductImageUpload
        label="제품사진"
        value={value.imageUrl}
        onChange={(url) => onChange({ ...value, imageUrl: url })}
        onClear={() => onChange({ ...value, imageUrl: "" })}
      />

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Label>상품정보 이미지 (최대 {MALL_PRODUCT_DETAIL_IMAGE_MAX}개)</Label>
          {detailImages.length < MALL_PRODUCT_DETAIL_IMAGE_MAX ? (
            <>
              <input
                ref={detailInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  setDetailUploading(true);
                  try {
                    const url = await uploadMallProductImageFile(file);
                    onChange({ ...value, detailImages: [...detailImages, url] });
                  } catch (err) {
                    alert(err instanceof Error ? err.message : "이미지 업로드 실패");
                  } finally {
                    setDetailUploading(false);
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={detailUploading}
                onClick={() => detailInputRef.current?.click()}
              >
                {detailUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    업로드 중
                  </>
                ) : (
                  "이미지 추가"
                )}
              </Button>
            </>
          ) : null}
        </div>
        {detailImages.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {detailImages.map((url, index) => (
              <div key={`${url}-${index}`} className="relative group">
                <img src={url} alt="" className="w-full aspect-square object-cover rounded border border-[#E9E9E9]" />
                <button
                  type="button"
                  className="absolute top-1 right-1 px-1.5 py-0.5 text-[10px] bg-black/70 text-white rounded opacity-0 group-hover:opacity-100"
                  onClick={() =>
                    onChange({
                      ...value,
                      detailImages: detailImages.filter((_, i) => i !== index),
                    })
                  }
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[#888]">상품 상세에 표시할 이미지를 추가하세요.</p>
        )}
      </div>

      <label className="flex items-center gap-2">
        <Checkbox
          checked={value.isActive ?? true}
          onCheckedChange={(v) => onChange({ ...value, isActive: !!v })}
        />
        <span className="text-sm">쇼핑몰 노출</span>
      </label>

      <div className="flex gap-2">
        <Button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="bg-[#E11936] hover:bg-[#B71C1C]"
        >
          저장
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          취소
        </Button>
      </div>
    </div>
  );
}
