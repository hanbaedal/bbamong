import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import AdminLayout from "./adminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/adminQueryClient";
import { useAdminAssets } from "@/contexts/AdminAssetContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

import MallCategoryNav from "@/components/mall/MallCategoryNav";
import MallProductForm, {
  createEmptyMallProduct,
  type MallProductFormValues,
} from "@/components/admin/MallProductForm";
import { MALL_DEFAULT_CATEGORIES } from "@shared/mallConfig";
import { calculateDiscountedPrice, MALL_DEFAULT_SHIPPING_LABEL, MALL_DEFAULT_PROCURE_NOTICE } from "@shared/mallProduct";
import { formatKrw } from "@/lib/mallCart";

type Tab = "catalog" | "settings" | "inquiries";

interface HomePageSettings {
  greetingPrefix: string;
  subGreeting: string;
  buttonText: string;
  buttonEnabled: boolean;
  showDate: boolean;
  gameGuideTitle: string;
  gameGuideSummary: string;
  gameGuideContent: string;
  gameGuideEnabled: boolean;
  gameGuideImageUrl: string;
  goodsSectionTitle: string;
  goodsSectionEnabled: boolean;
  introVideoUrl?: string;
  shopInquiryEmail?: string;
  shopInquiryPhone?: string;
}

interface GoodsCategory {
  id: number;
  name: string;
  description: string;
  imageUrl: string;
  displayOrder: number;
  isActive: boolean;
  productCount?: number;
}

interface GoodsProduct {
  id: number;
  categoryId: number;
  name: string;
  summary: string;
  detailContent: string;
  imageUrl: string;
  priceLabel: string;
  priceAmount?: number;
  originalPriceAmount?: number;
  discountPercent?: number;
  brand?: string;
  color?: string;
  size?: string;
  stockQuantity?: number;
  variants?: { color: string; size: string; stock: number }[];
  fulfillmentType?: "stock" | "procure";
  procureNotice?: string;
  shippingLabel?: string;
  detailImages?: string[];
  purchaseUrl?: string;
  displayOrder: number;
  isActive: boolean;
}

function productToForm(product: Partial<GoodsProduct>): Partial<MallProductFormValues> {
  return {
    id: product.id,
    categoryId: product.categoryId ?? 0,
    name: product.name ?? "",
    brand: product.brand ?? "",
    color: product.color ?? "",
    size: product.size ?? "",
    summary: product.summary ?? "",
    originalPriceAmount: product.originalPriceAmount ?? 0,
    discountPercent: product.discountPercent ?? 0,
    priceAmount:
      product.priceAmount ??
      calculateDiscountedPrice(product.originalPriceAmount ?? 0, product.discountPercent ?? 0),
    shippingLabel: product.shippingLabel ?? MALL_DEFAULT_SHIPPING_LABEL,
    stockQuantity: product.stockQuantity ?? -1,
    variants: product.variants ?? [],
    fulfillmentType: product.fulfillmentType ?? "stock",
    procureNotice: product.procureNotice ?? MALL_DEFAULT_PROCURE_NOTICE,
    imageUrl: product.imageUrl ?? "",
    detailImages: product.detailImages ?? [],
    isActive: product.isActive ?? true,
  };
}

function formToProduct(form: Partial<MallProductFormValues>): Partial<GoodsProduct> {
  const priceAmount = calculateDiscountedPrice(
    form.originalPriceAmount ?? 0,
    form.discountPercent ?? 0,
  );
  return {
    id: form.id,
    categoryId: form.categoryId ?? 0,
    name: form.name ?? "",
    brand: form.brand ?? "",
    color: form.color ?? "",
    size: form.size ?? "",
    summary: form.summary ?? "",
    detailContent: form.summary ?? "",
    originalPriceAmount: form.originalPriceAmount ?? 0,
    discountPercent: form.discountPercent ?? 0,
    priceAmount,
    shippingLabel: form.shippingLabel ?? MALL_DEFAULT_SHIPPING_LABEL,
    stockQuantity: form.stockQuantity ?? -1,
    variants: form.variants ?? [],
    fulfillmentType: form.fulfillmentType ?? "stock",
    procureNotice: form.procureNotice ?? "",
    imageUrl: form.imageUrl ?? "",
    detailImages: form.detailImages ?? [],
    isActive: form.isActive ?? true,
  };
}

interface ShopInquiry {
  id: number;
  productId: number;
  productName: string;
  customerName: string;
  phone: string;
  email: string;
  message: string;
  status: "pending" | "done";
  createdAt: string;
}

interface AdminHomepageData {
  settings: HomePageSettings;
  categories: GoodsCategory[];
  products: GoodsProduct[];
}

function openProductEditor(
  product: Partial<GoodsProduct> | null,
  categoryId?: number,
): Partial<MallProductFormValues> {
  if (product) return productToForm(product);
  return createEmptyMallProduct(categoryId);
}

export default function HomePageManagementPage() {
  const { assets } = useAdminAssets();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("catalog");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [settingsForm, setSettingsForm] = useState<HomePageSettings | null>(null);
  const [editingCategory, setEditingCategory] = useState<Partial<GoodsCategory> | null>(null);
  const [editingProduct, setEditingProduct] = useState<Partial<MallProductFormValues> | null>(null);

  const { data, isLoading } = useQuery<AdminHomepageData>({
    queryKey: ["/api/admin/homepage-settings"],
  });

  useEffect(() => {
    if (data?.settings) {
      setSettingsForm(data.settings);
    }
  }, [data]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/homepage-settings"] });
    queryClient.invalidateQueries({ queryKey: ["/api/homepage-settings"] });
    queryClient.invalidateQueries({ queryKey: ["/api/homepage/content"] });
  };

  const saveSettingsMutation = useMutation({
    mutationFn: async (payload: HomePageSettings) =>
      apiRequest("PUT", "/api/admin/homepage-settings", payload),
    onSuccess: () => {
      invalidate();
      toast({ description: "저장되었습니다." });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", description: err.message || "저장 실패" });
    },
  });

  const saveCategoryMutation = useMutation({
    mutationFn: async (cat: Partial<GoodsCategory>) => {
      if (cat.id) {
        return apiRequest("PATCH", `/api/admin/homepage/goods/categories/${cat.id}`, cat);
      }
      return apiRequest("POST", "/api/admin/homepage/goods/categories", cat);
    },
    onSuccess: () => {
      invalidate();
      setEditingCategory(null);
      toast({ description: "분류가 저장되었습니다." });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", description: err.message || "저장 실패" });
    },
  });

  const saveProductMutation = useMutation({
    mutationFn: async (product: Partial<MallProductFormValues>) =>
      product.id
        ? apiRequest("PATCH", `/api/admin/homepage/goods/products/${product.id}`, formToProduct(product))
        : apiRequest("POST", "/api/admin/homepage/goods/products", formToProduct(product)),
    onSuccess: () => {
      invalidate();
      setEditingProduct(null);
      toast({ description: "상품이 저장되었습니다." });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", description: err.message || "저장 실패" });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: number) =>
      apiRequest("DELETE", `/api/admin/homepage/goods/products/${id}`),
    onSuccess: () => {
      invalidate();
      toast({ description: "상품이 삭제되었습니다." });
    },
  });

  const { data: inquiriesData, refetch: refetchInquiries } = useQuery<{ inquiries: ShopInquiry[] }>({
    queryKey: ["/api/admin/shop/inquiries"],
    enabled: activeTab === "inquiries",
  });

  const updateInquiryMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "pending" | "done" }) =>
      apiRequest("PATCH", `/api/admin/shop/inquiries/${id}`, { status }),
    onSuccess: () => {
      refetchInquiries();
      toast({ description: "처리 상태가 변경되었습니다." });
    },
  });

  const tabs: { id: Tab; label: string }[] = [
    { id: "catalog", label: "상품 관리" },
    { id: "settings", label: "몰 설정" },
    { id: "inquiries", label: "구매 문의" },
  ];

  if (isLoading || !settingsForm) {
    return (
      <AdminLayout>
        <div className="text-[#BFBFBF] p-8">불러오는 중...</div>
      </AdminLayout>
    );
  }

  const categories = data?.categories ?? [];
  const products = data?.products ?? [];
  const visibleProducts =
    selectedCategoryId === null
      ? products
      : products.filter((p) => p.categoryId === selectedCategoryId);
  const selectedCategory =
    selectedCategoryId === null
      ? null
      : categories.find((c) => c.id === selectedCategoryId) ?? null;
  const mallMenuNames = MALL_DEFAULT_CATEGORIES.map((c) => c.name).join(" · ");

  return (
    <AdminLayout>
      <div className="flex flex-col h-full min-h-0">
        <div className="flex items-center gap-2 mb-3 shrink-0">
          <span className="text-xs text-[#BFBFBF]">쇼핑몰</span>
          <span className="text-xs text-[#BFBFBF]">&gt;</span>
          <span className="text-xs text-[#201E22]">쇼핑몰 관리</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 shrink-0">
          <h1 className="text-xl md:text-2xl font-semibold text-[#201E22] flex items-center gap-2">
            <img src={assets.adMatchCharaterIcon} className="w-8 h-8" alt="" />
            쇼핑몰 관리
          </h1>
          <Button
            type="button"
            variant="outline"
            className="border-[#E11936] text-[#E11936] hover:bg-[#FFF9FA]"
            onClick={() => setLocation("/admin/mall-preview")}
          >
            쇼핑몰 확인
          </Button>
        </div>

        <div className="flex gap-2 border-b border-[#E9E9E9] mb-4 overflow-x-auto shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`pb-2 px-3 text-sm whitespace-nowrap font-medium border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "border-[#E11936] text-[#E11936]"
                  : "border-transparent text-[#888]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "catalog" && (
          <div className="mb-4 shrink-0 space-y-2">
            <p className="text-xs text-[#888]">
              쇼핑몰 헤더 메뉴와 동일한 카테고리입니다. ({mallMenuNames})
            </p>
            <MallCategoryNav
              categories={categories}
              activeCategoryId={selectedCategoryId}
              variant="admin"
              onSelect={(id) => {
                setSelectedCategoryId(id);
                setEditingProduct(null);
                if (id !== null) {
                  const cat = categories.find((c) => c.id === id);
                  setEditingCategory(cat ?? null);
                } else {
                  setEditingCategory(null);
                }
              }}
            />
          </div>
        )}

        <div className="flex-1 overflow-auto min-h-0 max-w-3xl pb-8">
          {activeTab === "catalog" && (
            <div className="space-y-4">
              {selectedCategory && editingCategory && (
                <div className="border border-[#E9E9E9] rounded-lg p-4 space-y-3 bg-[#FAFAFA]">
                  <h3 className="font-medium">{selectedCategory.name} 카테고리</h3>
                  <Input
                    placeholder="설명"
                    value={editingCategory.description ?? ""}
                    onChange={(e) =>
                      setEditingCategory({ ...editingCategory, description: e.target.value })
                    }
                  />
                  <Input
                    placeholder="이미지 URL"
                    value={editingCategory.imageUrl ?? ""}
                    onChange={(e) =>
                      setEditingCategory({ ...editingCategory, imageUrl: e.target.value })
                    }
                  />
                  <Input
                    type="number"
                    placeholder="표시 순서"
                    value={editingCategory.displayOrder ?? 0}
                    onChange={(e) =>
                      setEditingCategory({
                        ...editingCategory,
                        displayOrder: parseInt(e.target.value, 10) || 0,
                      })
                    }
                  />
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={editingCategory.isActive ?? true}
                      onCheckedChange={(v) =>
                        setEditingCategory({ ...editingCategory, isActive: !!v })
                      }
                    />
                    <span className="text-sm">쇼핑몰 노출</span>
                  </label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={() => saveCategoryMutation.mutate(editingCategory)}
                      className="bg-[#E11936] hover:bg-[#B71C1C]"
                    >
                      카테고리 저장
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center">
                <p className="text-sm text-[#666]">
                  {selectedCategory
                    ? `${selectedCategory.name} 상품`
                    : "전체 상품 (쇼핑몰 '전체' 메뉴)"}
                  {" · "}
                  <span className="font-semibold text-[#201E22]">{visibleProducts.length}</span>개
                </p>
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    setEditingProduct(openProductEditor(null, selectedCategoryId ?? categories[0]?.id))
                  }
                  disabled={categories.length === 0}
                >
                  + 상품 추가
                </Button>
              </div>

              {editingProduct && (
                <MallProductForm
                  categories={categories}
                  value={editingProduct}
                  onChange={setEditingProduct}
                  onSave={() => saveProductMutation.mutate(editingProduct)}
                  onCancel={() => setEditingProduct(null)}
                  saving={saveProductMutation.isPending}
                />
              )}

              <div className="space-y-2">
                {visibleProducts.length === 0 ? (
                  <p className="text-sm text-[#888] py-8 text-center">등록된 상품이 없습니다.</p>
                ) : (
                  visibleProducts.map((p) => {
                    const cat = categories.find((c) => c.id === p.categoryId);
                    return (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 p-3 border border-[#E9E9E9] rounded-lg"
                      >
                        <div className="w-12 h-12 rounded bg-[#F0F0F0] overflow-hidden flex-shrink-0">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-[#999]">
                              N/A
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{p.name}</p>
                          <p className="text-xs text-[#888]">
                            {cat?.name}
                            {p.color ? ` · ${p.color}` : ""}
                            {p.size ? ` · ${p.size}` : ""}
                          </p>
                          <p className="text-xs text-[#666] mt-0.5">
                            {p.originalPriceAmount ? formatKrw(p.originalPriceAmount) : ""}
                            {p.discountPercent ? ` · ${p.discountPercent}%` : ""}
                            {p.priceAmount ? ` → ${formatKrw(p.priceAmount)}` : ""}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingProduct(productToForm(p))}
                          >
                            수정
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="text-[#E11936]"
                            onClick={() => {
                              if (confirm(`"${p.name}" 상품을 삭제할까요?`)) {
                                deleteProductMutation.mutate(p.id);
                              }
                            }}
                          >
                            삭제
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveSettingsMutation.mutate(settingsForm);
              }}
              className="space-y-4"
            >
              <p className="text-sm text-[#666]">ppamong.com/shop 쇼핑몰 표시 설정입니다.</p>
              <div className="space-y-2">
                <Label>쇼핑몰 제목 (헤더)</Label>
                <Input
                  placeholder="PPAMONG 스포츠몰"
                  value={settingsForm.goodsSectionTitle}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, goodsSectionTitle: e.target.value })
                  }
                />
              </div>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={settingsForm.goodsSectionEnabled}
                  onCheckedChange={(v) =>
                    setSettingsForm({ ...settingsForm, goodsSectionEnabled: !!v })
                  }
                />
                <span className="text-sm">쇼핑몰 노출</span>
              </label>
              <div className="space-y-2">
                <Label>회사소개 영상 URL</Label>
                <Input
                  value={settingsForm.introVideoUrl ?? "/videos/company-intro.mp4"}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, introVideoUrl: e.target.value })
                  }
                  placeholder="/videos/company-intro.mp4"
                />
              </div>
              <div className="space-y-2">
                <Label>구매 문의 이메일</Label>
                <Input
                  type="email"
                  value={settingsForm.shopInquiryEmail ?? ""}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, shopInquiryEmail: e.target.value })
                  }
                  placeholder="shop@ppamong.com"
                />
              </div>
              <div className="space-y-2">
                <Label>구매 문의 전화 (선택)</Label>
                <Input
                  value={settingsForm.shopInquiryPhone ?? ""}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, shopInquiryPhone: e.target.value })
                  }
                  placeholder="02-0000-0000"
                />
              </div>
              <p className="text-xs text-[#888]">
                앱 홈·예측 게임 문구는 관리자 메뉴의 &apos;앱 홈 설정&apos;에서 수정합니다.
              </p>
              <Button type="submit" className="bg-[#E11936] hover:bg-[#B71C1C]">
                저장
              </Button>
            </form>
          )}

          {activeTab === "inquiries" && (
            <div className="space-y-4">
              <p className="text-sm text-[#666]">
                쇼핑몰 상품 상세에서 접수된 구매 문의입니다.
              </p>
              {(inquiriesData?.inquiries ?? []).length === 0 ? (
                <p className="text-sm text-[#888] py-8 text-center">접수된 문의가 없습니다.</p>
              ) : (
                <div className="space-y-3">
                  {inquiriesData?.inquiries.map((inq) => (
                    <div
                      key={inq.id}
                      className="border border-[#E9E9E9] rounded-lg p-4 bg-white"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <p className="font-medium text-sm text-[#201E22]">{inq.productName}</p>
                          <p className="text-xs text-[#888]">
                            {inq.customerName}
                            {inq.phone ? ` · ${inq.phone}` : ""}
                            {inq.email ? ` · ${inq.email}` : ""}
                          </p>
                          <p className="text-xs text-[#BFBFBF] mt-1">
                            {new Date(inq.createdAt).toLocaleString("ko-KR")}
                          </p>
                        </div>
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            inq.status === "done"
                              ? "bg-[#E8F5E9] text-[#2E7D32]"
                              : "bg-[#FFF3E0] text-[#E65100]"
                          }`}
                        >
                          {inq.status === "done" ? "처리완료" : "대기"}
                        </span>
                      </div>
                      <p className="text-sm text-[#4D4B4E] whitespace-pre-wrap mb-3">{inq.message}</p>
                      {inq.status === "pending" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            updateInquiryMutation.mutate({ id: inq.id, status: "done" })
                          }
                        >
                          처리완료
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
