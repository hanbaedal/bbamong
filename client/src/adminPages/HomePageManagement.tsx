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

import MallCategoryNav from "@/components/mall/MallCategoryNav";
import MallProductForm, {
  createEmptyMallProduct,
  sanitizeMallProductForm,
  validateMallProductForm,
  type MallProductFormValues,
} from "@/components/admin/MallProductForm";
import { MALL_DEFAULT_CATEGORIES } from "@shared/mallConfig";
import { adminFormGridClass, adminPageShellClass, adminTableClass, adminTableWrapClass } from "./components/adminPageStyles";
import { calculateDiscountedPrice, MALL_DEFAULT_SHIPPING_LABEL, MALL_DEFAULT_PROCURE_NOTICE } from "@shared/mallProduct";
import { formatKrw } from "@/lib/mallCart";

type Tab = "register" | "list" | "settings" | "inquiries";

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
  reorderPoint?: number;
  optimalStock?: number;
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
    reorderPoint: product.reorderPoint ?? 0,
    optimalStock: product.optimalStock ?? 0,
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
    reorderPoint: form.reorderPoint ?? 0,
    optimalStock: form.optimalStock ?? 0,
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

const TAB_HINTS: Record<Tab, string> = {
  register: "새 상품을 등록합니다. 수정·삭제는 「상품 리스트」 탭에서 하세요.",
  list: "등록된 상품을 검색·수정·삭제합니다.",
  settings: "ppamong.com/shop 화면에 보이는 쇼핑몰 이름, 노출 여부, 소개 영상, 문의 연락처를 설정합니다.",
  inquiries:
    "고객이 쇼핑몰 상품 페이지에서 보낸 구매 문의 목록입니다. 전화·이메일로 답변한 뒤 「처리완료」로 표시하세요. (여기서 답변글을 보내는 기능은 없습니다.)",
};

export default function HomePageManagementPage() {
  const { assets } = useAdminAssets();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("register");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [settingsForm, setSettingsForm] = useState<HomePageSettings | null>(null);
  const [editingCategory, setEditingCategory] = useState<Partial<GoodsCategory> | null>(null);
  const [registerForm, setRegisterForm] = useState<Partial<MallProductFormValues> | null>(null);
  const [listEditForm, setListEditForm] = useState<Partial<MallProductFormValues> | null>(null);
  const [registerSaveError, setRegisterSaveError] = useState("");
  const [listSaveError, setListSaveError] = useState("");
  const [showCategoryEditor, setShowCategoryEditor] = useState(false);

  const { data, isLoading } = useQuery<AdminHomepageData>({
    queryKey: ["/api/admin/homepage-settings"],
  });

  const categories = data?.categories ?? [];
  const products = data?.products ?? [];

  useEffect(() => {
    if (data?.settings) {
      setSettingsForm(data.settings);
    }
  }, [data]);

  useEffect(() => {
    if (categories.length > 0 && !registerForm) {
      const catId =
        selectedCategoryId && selectedCategoryId > 0 ? selectedCategoryId : categories[0].id;
      setRegisterForm(createEmptyMallProduct(catId));
    }
  }, [categories, registerForm, selectedCategoryId]);

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
      toast({ description: "쇼핑몰 표시 설정이 저장되었습니다." });
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
      toast({ description: "카테고리가 저장되었습니다." });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", description: err.message || "저장 실패" });
    },
  });

  const createProductMutation = useMutation({
    mutationFn: async (product: Partial<MallProductFormValues>) =>
      apiRequest("POST", "/api/admin/homepage/goods/products", formToProduct(sanitizeMallProductForm(product))),
    onSuccess: (_res, product) => {
      invalidate();
      setRegisterSaveError("");
      setRegisterForm(createEmptyMallProduct(product.categoryId));
      toast({ description: "상품이 등록되었습니다." });
    },
    onError: (err: Error) => {
      const message = err.message || "등록 실패";
      setRegisterSaveError(message);
      toast({ variant: "destructive", description: message });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async (product: Partial<MallProductFormValues>) =>
      apiRequest(
        "PATCH",
        `/api/admin/homepage/goods/products/${product.id}`,
        formToProduct(sanitizeMallProductForm(product)),
      ),
    onSuccess: () => {
      invalidate();
      setListEditForm(null);
      setListSaveError("");
      toast({ description: "상품이 수정되었습니다." });
    },
    onError: (err: Error) => {
      const message = err.message || "수정 실패";
      setListSaveError(message);
      toast({ variant: "destructive", description: message });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: number) =>
      apiRequest("DELETE", `/api/admin/homepage/goods/products/${id}`),
    onSuccess: () => {
      invalidate();
      setListEditForm(null);
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
      toast({ description: "처리완료로 표시했습니다." });
    },
  });

  const handleSaveRegister = () => {
    if (!registerForm) return;
    const error = validateMallProductForm(registerForm, categories);
    if (error) {
      setRegisterSaveError(error);
      toast({ variant: "destructive", description: error });
      return;
    }
    setRegisterSaveError("");
    createProductMutation.mutate({ ...registerForm, id: undefined });
  };

  const handleSaveListEdit = () => {
    if (!listEditForm?.id) return;
    const error = validateMallProductForm(listEditForm, categories);
    if (error) {
      setListSaveError(error);
      toast({ variant: "destructive", description: error });
      return;
    }
    setListSaveError("");
    updateProductMutation.mutate(listEditForm);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "register", label: "상품 등록" },
    { id: "list", label: "상품 리스트" },
    { id: "settings", label: "쇼핑몰 표시" },
    { id: "inquiries", label: "구매 문의" },
  ];

  if (isLoading || !settingsForm) {
    return (
      <AdminLayout>
        <div className="text-[#BFBFBF] p-8">불러오는 중...</div>
      </AdminLayout>
    );
  }

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
      <div className={adminPageShellClass}>
        <div className="flex items-center gap-2 mb-3 shrink-0">
          <span className="text-xs lg:text-sm text-[#BFBFBF]">쇼핑몰</span>
          <span className="text-xs lg:text-sm text-[#BFBFBF]">&gt;</span>
          <span className="text-xs lg:text-sm text-[#201E22]">쇼핑몰 관리</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 shrink-0">
          <h1 className="text-xl lg:text-2xl xl:text-[1.75rem] font-semibold text-[#201E22] flex items-center gap-2">
            <img src={assets.adMatchCharaterIcon} className="w-8 h-8 lg:w-9 lg:h-9" alt="" />
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

        <div className="flex gap-2 border-b border-[#E9E9E9] mb-3 overflow-x-auto shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === "list") setListEditForm(null);
              }}
              className={`pb-2 px-3 text-sm lg:text-base whitespace-nowrap font-medium border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "border-[#E11936] text-[#E11936]"
                  : "border-transparent text-[#888]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <p className="text-sm lg:text-base text-[#666] mb-4 shrink-0 bg-[#FAFAFA] border border-[#E9E9E9] rounded-lg px-3 py-2">
          {TAB_HINTS[activeTab]}
        </p>

        {(activeTab === "register" || activeTab === "list") && (
          <div className="mb-4 shrink-0 space-y-2">
            <p className="text-xs lg:text-sm text-[#888]">
              카테고리 필터 · 쇼핑몰 메뉴: {mallMenuNames}
            </p>
            <MallCategoryNav
              categories={categories}
              activeCategoryId={selectedCategoryId}
              variant="admin"
              onSelect={(id) => {
                setSelectedCategoryId(id);
                if (activeTab === "register") {
                  if (id !== null) {
                    const cat = categories.find((c) => c.id === id);
                    setEditingCategory(cat ?? null);
                    setRegisterForm((prev) =>
                      prev ? { ...prev, categoryId: id } : createEmptyMallProduct(id),
                    );
                  } else {
                    setEditingCategory(null);
                    setShowCategoryEditor(false);
                  }
                }
              }}
            />
          </div>
        )}

        <div className="flex-1 overflow-auto min-h-0 w-full pb-4">
          {activeTab === "register" && (
            <div className="space-y-4 max-w-5xl">
              {selectedCategory && editingCategory ? (
                <div className="border border-[#E9E9E9] rounded-lg bg-[#FAFAFA] overflow-hidden">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium bg-white"
                    onClick={() => setShowCategoryEditor((v) => !v)}
                  >
                    <span>{selectedCategory.name} 카테고리 설정</span>
                    <span className="text-xs text-[#888]">{showCategoryEditor ? "접기" : "펼치기"}</span>
                  </button>
                  {showCategoryEditor ? (
                    <div className="p-3 space-y-2 border-t border-[#E9E9E9]">
                      <Input
                        className="h-9 lg:h-10 text-sm lg:text-base"
                        placeholder="설명"
                        value={editingCategory.description ?? ""}
                        onChange={(e) =>
                          setEditingCategory({ ...editingCategory, description: e.target.value })
                        }
                      />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <Input
                          className="h-9 lg:h-10 text-sm lg:text-base"
                          placeholder="이미지 URL"
                          value={editingCategory.imageUrl ?? ""}
                          onChange={(e) =>
                            setEditingCategory({ ...editingCategory, imageUrl: e.target.value })
                          }
                        />
                        <Input
                          className="h-9 lg:h-10 text-sm lg:text-base"
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
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={editingCategory.isActive ?? true}
                          onCheckedChange={(v) =>
                            setEditingCategory({ ...editingCategory, isActive: !!v })
                          }
                        />
                        쇼핑몰 노출
                      </label>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => saveCategoryMutation.mutate(editingCategory)}
                        className="bg-[#E11936] hover:bg-[#B71C1C]"
                      >
                        카테고리 저장
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {registerForm && categories.length > 0 ? (
                <MallProductForm
                  categories={categories}
                  value={registerForm}
                  onChange={(patch) =>
                    setRegisterForm((prev) => ({ ...(prev ?? createEmptyMallProduct()), ...patch, id: undefined }))
                  }
                  onSave={handleSaveRegister}
                  onCancel={() => {
                    setRegisterSaveError("");
                    setRegisterForm(createEmptyMallProduct(registerForm.categoryId));
                  }}
                  saving={createProductMutation.isPending}
                  saveError={registerSaveError}
                  mode="create"
                />
              ) : (
                <p className="text-sm text-[#888]">카테고리가 없습니다. 먼저 카테고리를 설정해 주세요.</p>
              )}
            </div>
          )}

          {activeTab === "list" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm lg:text-base text-[#666]">
                  {selectedCategory ? `${selectedCategory.name}` : "전체"} ·{" "}
                  <span className="font-semibold text-[#201E22]">{visibleProducts.length}</span>개
                </p>
              </div>

              {listEditForm ? (
                <MallProductForm
                  categories={categories}
                  value={listEditForm}
                  onChange={(patch) =>
                    setListEditForm((prev) => ({ ...(prev ?? createEmptyMallProduct()), ...patch }))
                  }
                  onSave={handleSaveListEdit}
                  onCancel={() => {
                    setListEditForm(null);
                    setListSaveError("");
                  }}
                  saving={updateProductMutation.isPending}
                  saveError={listSaveError}
                  mode="edit"
                />
              ) : null}

              <div className={adminTableWrapClass}>
                <table className={adminTableClass}>
                  <thead className="bg-[#FAFAFA]">
                    <tr>
                      <th className="text-left p-3 w-14">사진</th>
                      <th className="text-left p-3">상품명</th>
                      <th className="text-left p-3">카테고리</th>
                      <th className="text-right p-3">가격</th>
                      <th className="text-center p-3">노출</th>
                      <th className="text-right p-3 w-32">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleProducts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-[#888]">
                          등록된 상품이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      visibleProducts.map((p) => {
                        const cat = categories.find((c) => c.id === p.categoryId);
                        const isEditing = listEditForm?.id === p.id;
                        return (
                          <tr
                            key={p.id}
                            className={`border-t border-[#F0F0F0] ${isEditing ? "bg-[#FFF9FA]" : ""}`}
                          >
                            <td className="p-2">
                              <div className="w-10 h-10 rounded bg-[#F0F0F0] overflow-hidden">
                                {p.imageUrl ? (
                                  <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                                ) : null}
                              </div>
                            </td>
                            <td className="p-3 font-medium">{p.name}</td>
                            <td className="p-3 text-[#666]">{cat?.name ?? "—"}</td>
                            <td className="p-3 text-right whitespace-nowrap">
                              {p.priceAmount ? formatKrw(p.priceAmount) : "—"}
                            </td>
                            <td className="p-3 text-center">
                              {p.isActive ? (
                                <span className="text-xs text-green-700">노출</span>
                              ) : (
                                <span className="text-xs text-[#888]">숨김</span>
                              )}
                            </td>
                            <td className="p-3">
                              <div className="flex justify-end gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8"
                                  onClick={() => {
                                    setListSaveError("");
                                    setListEditForm(productToForm(p));
                                  }}
                                >
                                  수정
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-[#E11936]"
                                  onClick={() => {
                                    if (confirm(`"${p.name}" 상품을 삭제할까요?`)) {
                                      deleteProductMutation.mutate(p.id);
                                    }
                                  }}
                                >
                                  삭제
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveSettingsMutation.mutate(settingsForm);
              }}
              className={`${adminFormGridClass} max-w-4xl`}
            >
              <div className="md:col-span-2 xl:col-span-3 space-y-1">
                <h2 className="text-base lg:text-lg font-semibold text-[#201E22]">쇼핑몰 화면 설정</h2>
                <p className="text-sm text-[#666]">
                  고객이 보는 /shop 페이지의 제목·노출·소개 영상·문의 연락처입니다.
                  앱 홈 문구는 「앱 홈 설정」 메뉴에서 수정합니다.
                </p>
              </div>

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

              <div className="space-y-2 flex items-end">
                <label className="flex items-center gap-2 pb-2">
                  <Checkbox
                    checked={settingsForm.goodsSectionEnabled}
                    onCheckedChange={(v) =>
                      setSettingsForm({ ...settingsForm, goodsSectionEnabled: !!v })
                    }
                  />
                  <span className="text-sm">쇼핑몰 메뉴·페이지 노출</span>
                </label>
              </div>

              <div className="space-y-2 md:col-span-2">
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
                <Label>문의 이메일 (쇼핑몰 표시)</Label>
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
                <Label>문의 전화 (쇼핑몰 표시, 선택)</Label>
                <Input
                  value={settingsForm.shopInquiryPhone ?? ""}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, shopInquiryPhone: e.target.value })
                  }
                  placeholder="02-0000-0000"
                />
              </div>

              <div className="md:col-span-2 xl:col-span-3">
                <Button type="submit" className="bg-[#E11936] hover:bg-[#B71C1C]">
                  저장
                </Button>
              </div>
            </form>
          )}

          {activeTab === "inquiries" && (
            <div className="space-y-4">
              {(inquiriesData?.inquiries ?? []).length === 0 ? (
                <p className="text-sm text-[#888] py-8 text-center border border-dashed border-[#E9E9E9] rounded-lg">
                  접수된 구매 문의가 없습니다.
                </p>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                  {inquiriesData?.inquiries.map((inq) => (
                    <div
                      key={inq.id}
                      className="border border-[#E9E9E9] rounded-lg p-4 bg-white flex flex-col"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-[#201E22] truncate">{inq.productName}</p>
                          <p className="text-xs text-[#888] mt-1">
                            {inq.customerName}
                            {inq.phone ? ` · ${inq.phone}` : ""}
                          </p>
                          {inq.email ? (
                            <a
                              href={`mailto:${inq.email}`}
                              className="text-xs text-[#E11936] block truncate"
                            >
                              {inq.email}
                            </a>
                          ) : null}
                          <p className="text-xs text-[#BFBFBF] mt-1">
                            {new Date(inq.createdAt).toLocaleString("ko-KR")}
                          </p>
                        </div>
                        <span
                          className={`text-xs px-2 py-1 rounded shrink-0 ${
                            inq.status === "done"
                              ? "bg-[#E8F5E9] text-[#2E7D32]"
                              : "bg-[#FFF3E0] text-[#E65100]"
                          }`}
                        >
                          {inq.status === "done" ? "처리완료" : "답변 대기"}
                        </span>
                      </div>
                      <p className="text-sm text-[#4D4B4E] whitespace-pre-wrap flex-1 mb-3">{inq.message}</p>
                      {inq.status === "pending" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="self-start"
                          onClick={() =>
                            updateInquiryMutation.mutate({ id: inq.id, status: "done" })
                          }
                        >
                          처리완료 (답변 후)
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
