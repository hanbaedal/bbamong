import { useMemo, useRef, useState } from "react";
import {
  calculateDiscountedPrice,
  MALL_DEFAULT_SHIPPING_LABEL,
  MALL_DEFAULT_PROCURE_NOTICE,
  MALL_FULFILLMENT_OPTIONS,
  MALL_PRODUCT_DETAIL_IMAGE_MAX,
  MALL_PRODUCT_DETAIL_IMAGE_MAX_BYTES,
  MALL_PRODUCT_DETAIL_MAX_WIDTH,
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
  reorderPoint: number;
  optimalStock: number;
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
  onChange: (patch: Partial<MallProductFormValues>) => void;
  onSave: () => void;
  onCancel: () => void;
  saving?: boolean;
  saveError?: string;
  mode?: "create" | "edit";
}

export function createEmptyMallProduct(categoryId?: number): Partial<MallProductFormValues> {
  return {
    categoryId: categoryId && categoryId > 0 ? categoryId : 0,
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
    reorderPoint: 0,
    optimalStock: 0,
    imageUrl: "",
    detailImages: [],
    isActive: true,
  };
}

export function validateMallProductForm(
  form: Partial<MallProductFormValues>,
  categories: GoodsCategoryOption[],
): string | null {
  if (!form.categoryId || form.categoryId <= 0) {
    return "카테고리를 선택해 주세요.";
  }
  if (!categories.some((c) => c.id === form.categoryId)) {
    return "유효한 카테고리를 선택해 주세요.";
  }
  if (!form.name?.trim()) {
    return "제품명을 입력해 주세요.";
  }
  if ((form.originalPriceAmount ?? 0) < 0) {
    return "판매가격을 확인해 주세요.";
  }
  return null;
}

export function sanitizeMallProductForm(
  form: Partial<MallProductFormValues>,
): Partial<MallProductFormValues> {
  const variants = (form.variants ?? []).filter(
    (v) => v.color.trim() || v.size.trim() || v.stock > 0,
  );
  return {
    ...form,
    name: form.name?.trim() ?? "",
    brand: form.brand?.trim() ?? "",
    summary: form.summary?.trim() ?? "",
    variants,
  };
}

function parseOptionalInt(raw: string, fallback: number): number {
  const trimmed = raw.trim();
  if (trimmed === "") return fallback;
  const n = parseInt(trimmed, 10);
  return Number.isNaN(n) ? fallback : n;
}

export default function MallProductForm({
  categories,
  value,
  onChange,
  onSave,
  onCancel,
  saving = false,
  saveError,
  mode = value.id ? "edit" : "create",
}: MallProductFormProps) {
  const detailInputRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const [detailUploading, setDetailUploading] = useState(false);

  const discountedPrice = useMemo(
    () =>
      calculateDiscountedPrice(value.originalPriceAmount ?? 0, value.discountPercent ?? 0),
    [value.originalPriceAmount, value.discountPercent],
  );

  const setDiscountFields = (patch: Partial<MallProductFormValues>) => {
    const next = { ...valueRef.current, ...patch };
    const priceAmount = calculateDiscountedPrice(
      next.originalPriceAmount ?? 0,
      next.discountPercent ?? 0,
    );
    onChange({ ...patch, priceAmount });
  };

  const detailImages = value.detailImages ?? [];
  const variants = value.variants ?? [];
  const hasVariants = variants.length > 0;
  const isProcure = value.fulfillmentType === "procure";
  const categorySelectValue =
    value.categoryId && value.categoryId > 0 ? String(value.categoryId) : undefined;

  const updateVariant = (index: number, patch: Partial<MallProductVariant>) => {
    const next = variants.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange({ variants: next });
  };

  return (
    <div className="border border-[#E9E9E9] rounded-lg bg-[#FAFAFA] overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 lg:px-4 py-2 lg:py-2.5 border-b border-[#E9E9E9] bg-white">
        <h3 className="font-medium text-sm lg:text-base">
          {mode === "edit" ? "상품 수정" : "상품 등록"}
        </h3>
        <label className="flex items-center gap-1.5 text-xs lg:text-sm shrink-0">
          <Checkbox
            checked={value.isActive ?? true}
            onCheckedChange={(v) => onChange({ isActive: !!v })}
          />
          쇼핑몰 노출
        </label>
      </div>

      <div className="p-3 lg:p-4 space-y-3 lg:space-y-4 max-h-[calc(100vh-220px)] lg:max-h-[calc(100vh-180px)] overflow-y-auto">
        {saveError ? (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-2 py-1.5">
            {saveError}
          </p>
        ) : null}

        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-2 lg:gap-3">
          <div className="space-y-1">
            <Label className="text-xs lg:text-sm">판매 유형</Label>
            <Select
              value={value.fulfillmentType ?? "stock"}
              onValueChange={(v) =>
                onChange({
                  fulfillmentType: v as MallFulfillmentType,
                  procureNotice:
                    v === "procure"
                      ? value.procureNotice || MALL_DEFAULT_PROCURE_NOTICE
                      : value.procureNotice,
                })
              }
            >
              <SelectTrigger className="h-9 lg:h-10 text-sm lg:text-base">
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
          </div>

          <div className="space-y-1">
            <Label className="text-xs lg:text-sm">카테고리 *</Label>
            <Select
              value={categorySelectValue}
              onValueChange={(v) => onChange({ categoryId: parseInt(v, 10) })}
            >
              <SelectTrigger className="h-9 lg:h-10 text-sm lg:text-base">
                <SelectValue placeholder="선택" />
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

          <div className="space-y-1">
            <Label className="text-xs lg:text-sm">제품명 *</Label>
            <Input
              className="h-9 lg:h-10 text-sm lg:text-base"
              placeholder="제품명"
              value={value.name ?? ""}
              onChange={(e) => onChange({ name: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs lg:text-sm">브랜드</Label>
            <Input
              className="h-9 lg:h-10 text-sm lg:text-base"
              placeholder="브랜드"
              value={value.brand ?? ""}
              onChange={(e) => onChange({ brand: e.target.value })}
            />
          </div>
        </div>

        {isProcure ? (
          <div className="space-y-1">
            <Label className="text-xs lg:text-sm">주문후조달 안내</Label>
            <Textarea
              className="text-sm min-h-[52px]"
              value={value.procureNotice ?? MALL_DEFAULT_PROCURE_NOTICE}
              onChange={(e) => onChange({ procureNotice: e.target.value })}
              rows={2}
            />
          </div>
        ) : null}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {!hasVariants && !isProcure ? (
            <>
              <div className="space-y-1">
                <Label className="text-xs lg:text-sm">컬러</Label>
                <Input
                  className="h-9 lg:h-10 text-sm lg:text-base"
                  placeholder="블랙"
                  value={value.color ?? ""}
                  onChange={(e) => onChange({ color: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs lg:text-sm">사이즈</Label>
                <Input
                  className="h-9 lg:h-10 text-sm lg:text-base"
                  placeholder="M, L"
                  value={value.size ?? ""}
                  onChange={(e) => onChange({ size: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs lg:text-sm">재고</Label>
                <Input
                  className="h-9 lg:h-10 text-sm lg:text-base"
                  type="number"
                  min={-1}
                  placeholder="비우면 무제한"
                  value={value.stockQuantity === -1 ? "" : (value.stockQuantity ?? "")}
                  onChange={(e) =>
                    onChange({ stockQuantity: parseOptionalInt(e.target.value, -1) })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs lg:text-sm">리오더 / 적정재고</Label>
                <div className="flex gap-1">
                  <Input
                    className="h-9 lg:h-10 text-sm lg:text-base"
                    type="number"
                    min={0}
                    placeholder="리오더"
                    value={value.reorderPoint ?? 0}
                    onChange={(e) =>
                      onChange({ reorderPoint: parseOptionalInt(e.target.value, 0) })
                    }
                  />
                  <Input
                    className="h-9 lg:h-10 text-sm lg:text-base"
                    type="number"
                    min={0}
                    placeholder="적정"
                    value={value.optimalStock ?? 0}
                    onChange={(e) =>
                      onChange({ optimalStock: parseOptionalInt(e.target.value, 0) })
                    }
                  />
                </div>
              </div>
            </>
          ) : null}
          <div className="space-y-1">
            <Label className="text-xs lg:text-sm">배송</Label>
            <Input
              className="h-9 lg:h-10 text-sm lg:text-base"
              placeholder={MALL_DEFAULT_SHIPPING_LABEL}
              value={value.shippingLabel ?? MALL_DEFAULT_SHIPPING_LABEL}
              onChange={(e) => onChange({ shippingLabel: e.target.value })}
            />
          </div>
        </div>

        {!isProcure ? (
          <div className="border border-[#E9E9E9] rounded-md p-2 bg-white space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs lg:text-sm">옵션별 재고 (컬러·사이즈)</Label>
              {variants.length < MALL_PRODUCT_VARIANT_MAX ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() =>
                    onChange({
                      variants: [...variants, { color: "", size: "", stock: 0 }],
                    })
                  }
                >
                  + 옵션
                </Button>
              ) : null}
            </div>
            {variants.length > 0 ? (
              <div className="space-y-1">
                {variants.map((row, index) => (
                  <div key={index} className="grid grid-cols-[1fr_1fr_80px_52px] gap-1 items-center">
                    <Input
                      className="h-8 text-xs"
                      placeholder="컬러"
                      value={row.color}
                      onChange={(e) => updateVariant(index, { color: e.target.value })}
                    />
                    <Input
                      className="h-8 text-xs"
                      placeholder="사이즈"
                      value={row.size}
                      onChange={(e) => updateVariant(index, { size: e.target.value })}
                    />
                    <Input
                      className="h-8 text-xs"
                      type="number"
                      min={0}
                      placeholder="재고"
                      value={row.stock}
                      onChange={(e) =>
                        updateVariant(index, { stock: parseOptionalInt(e.target.value, 0) })
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => onChange({ variants: variants.filter((_, i) => i !== index) })}
                    >
                      삭제
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-[#888]">옵션 없으면 위 단일 재고 사용</p>
            )}
          </div>
        ) : null}

        <div className="space-y-1">
          <Label className="text-xs lg:text-sm">제품설명</Label>
          <Textarea
            className="text-sm min-h-[52px]"
            placeholder="상품 설명"
            value={value.summary ?? ""}
            onChange={(e) => onChange({ summary: e.target.value })}
            rows={2}
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-xs lg:text-sm">판매가 (원)</Label>
            <Input
              className="h-9 lg:h-10 text-sm lg:text-base"
              type="number"
              min={0}
              value={value.originalPriceAmount ? value.originalPriceAmount : ""}
              placeholder="0"
              onChange={(e) =>
                setDiscountFields({
                  originalPriceAmount: parseOptionalInt(e.target.value, 0),
                })
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs lg:text-sm">할인 (%)</Label>
            <Input
              className="h-9 lg:h-10 text-sm lg:text-base"
              type="number"
              min={0}
              max={100}
              value={value.discountPercent ? value.discountPercent : ""}
              placeholder="0"
              onChange={(e) =>
                setDiscountFields({
                  discountPercent: parseOptionalInt(e.target.value, 0),
                })
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs lg:text-sm">할인가 (자동)</Label>
            <Input
              className="h-9 text-sm bg-[#F5F5F5]"
              readOnly
              value={discountedPrice > 0 ? formatKrw(discountedPrice) : ""}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <MallProductImageUpload
            label="제품사진"
            value={value.imageUrl}
            onChange={(url) => onChange({ imageUrl: url })}
            onClear={() => onChange({ imageUrl: "" })}
            compact
          />

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs lg:text-sm">상품정보 이미지 ({detailImages.length}/{MALL_PRODUCT_DETAIL_IMAGE_MAX})</Label>
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
                        const url = await uploadMallProductImageFile(file, "detail");
                        const current = valueRef.current.detailImages ?? [];
                        onChange({ detailImages: [...current, url] });
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
                    className="h-7 text-xs"
                    disabled={detailUploading}
                    onClick={() => detailInputRef.current?.click()}
                  >
                    {detailUploading ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        업로드
                      </>
                    ) : (
                      "추가"
                    )}
                  </Button>
                </>
              ) : null}
            </div>
            {detailImages.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {detailImages.map((url, index) => (
                  <div key={`${url}-${index}`} className="relative group">
                    <img
                      src={url}
                      alt=""
                      className="w-14 h-14 object-cover rounded border border-[#E9E9E9]"
                    />
                    <button
                      type="button"
                      className="absolute -top-1 -right-1 w-4 h-4 text-[9px] bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100"
                      onClick={() =>
                        onChange({
                          detailImages: detailImages.filter((_, i) => i !== index),
                        })
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-[#888]">
                상세 탭 전체 너비 · 가로 {MALL_PRODUCT_DETAIL_MAX_WIDTH}px · {Math.round(MALL_PRODUCT_DETAIL_IMAGE_MAX_BYTES / 1024)}KB 이하 자동 압축
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-2 px-3 py-2 border-t border-[#E9E9E9] bg-white sticky bottom-0">
        <Button
          type="button"
          onClick={onSave}
          disabled={saving}
          size="sm"
          className="bg-[#E11936] hover:bg-[#B71C1C]"
        >
          {saving ? "저장 중..." : mode === "edit" ? "수정 저장" : "등록"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          {mode === "edit" ? "취소" : "입력 초기화"}
        </Button>
      </div>
    </div>
  );
}
