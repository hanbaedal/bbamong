import { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Tab = "basic" | "game" | "categories" | "products";

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
  displayOrder: number;
  isActive: boolean;
}

interface AdminHomepageData {
  settings: HomePageSettings;
  categories: GoodsCategory[];
  products: GoodsProduct[];
}

const emptyCategory = (): Partial<GoodsCategory> => ({
  name: "",
  description: "",
  imageUrl: "",
  displayOrder: 0,
  isActive: true,
});

const emptyProduct = (categoryId?: number): Partial<GoodsProduct> => ({
  categoryId: categoryId ?? 0,
  name: "",
  summary: "",
  detailContent: "",
  imageUrl: "",
  priceLabel: "",
  displayOrder: 0,
  isActive: true,
});

export default function HomePageManagementPage() {
  const { assets } = useAdminAssets();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("basic");
  const [settingsForm, setSettingsForm] = useState<HomePageSettings | null>(null);
  const [editingCategory, setEditingCategory] = useState<Partial<GoodsCategory> | null>(null);
  const [editingProduct, setEditingProduct] = useState<Partial<GoodsProduct> | null>(null);

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

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) =>
      apiRequest("DELETE", `/api/admin/homepage/goods/categories/${id}`),
    onSuccess: () => {
      invalidate();
      toast({ description: "분류가 삭제되었습니다." });
    },
  });

  const saveProductMutation = useMutation({
    mutationFn: async (product: Partial<GoodsProduct>) => {
      if (product.id) {
        return apiRequest("PATCH", `/api/admin/homepage/goods/products/${product.id}`, product);
      }
      return apiRequest("POST", "/api/admin/homepage/goods/products", product);
    },
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

  const tabs: { id: Tab; label: string }[] = [
    { id: "basic", label: "기본 설정" },
    { id: "game", label: "예측 게임 설명" },
    { id: "categories", label: "굿즈 분류" },
    { id: "products", label: "굿즈 상품" },
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

  return (
    <AdminLayout>
      <div className="flex flex-col h-full min-h-0">
        <div className="flex items-center gap-2 mb-3 shrink-0">
          <span className="text-xs text-[#BFBFBF]">홈 페이지</span>
          <span className="text-xs text-[#BFBFBF]">&gt;</span>
          <span className="text-xs text-[#201E22]">홈페이지 관리</span>
        </div>

        <h1 className="text-xl md:text-2xl font-semibold text-[#201E22] mb-4 flex items-center gap-2">
          <img src={assets.adMatchCharaterIcon} className="w-8 h-8" alt="" />
          홈페이지 관리
        </h1>

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

        <div className="flex-1 overflow-auto min-h-0 max-w-3xl pb-8">
          {activeTab === "basic" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveSettingsMutation.mutate(settingsForm);
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>인사말 (이름 앞)</Label>
                <Input
                  value={settingsForm.greetingPrefix}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, greetingPrefix: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>부가 문구</Label>
                <Input
                  value={settingsForm.subGreeting}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, subGreeting: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>경기 참여 버튼 문구</Label>
                <Input
                  value={settingsForm.buttonText}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, buttonText: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>굿즈 섹션 제목</Label>
                <Input
                  value={settingsForm.goodsSectionTitle}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, goodsSectionTitle: e.target.value })
                  }
                />
              </div>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={settingsForm.showDate}
                  onCheckedChange={(v) =>
                    setSettingsForm({ ...settingsForm, showDate: !!v })
                  }
                />
                <span className="text-sm">날짜 표시</span>
              </label>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={settingsForm.buttonEnabled}
                  onCheckedChange={(v) =>
                    setSettingsForm({ ...settingsForm, buttonEnabled: !!v })
                  }
                />
                <span className="text-sm">경기 참여 버튼 표시</span>
              </label>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={settingsForm.goodsSectionEnabled}
                  onCheckedChange={(v) =>
                    setSettingsForm({ ...settingsForm, goodsSectionEnabled: !!v })
                  }
                />
                <span className="text-sm">굿즈 섹션 표시</span>
              </label>
              <Button type="submit" className="bg-[#E11936] hover:bg-[#B71C1C]">
                저장
              </Button>
            </form>
          )}

          {activeTab === "game" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveSettingsMutation.mutate(settingsForm);
              }}
              className="space-y-4"
            >
              <p className="text-sm text-[#666]">
                사용자 앱 홈에서 &apos;야구 예측 게임&apos; 소개와 상세 페이지에 표시됩니다.
              </p>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={settingsForm.gameGuideEnabled}
                  onCheckedChange={(v) =>
                    setSettingsForm({ ...settingsForm, gameGuideEnabled: !!v })
                  }
                />
                <span className="text-sm">예측 게임 설명 노출</span>
              </label>
              <div className="space-y-2">
                <Label>제목</Label>
                <Input
                  value={settingsForm.gameGuideTitle}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, gameGuideTitle: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>요약 (홈 화면 카드)</Label>
                <Textarea
                  value={settingsForm.gameGuideSummary}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, gameGuideSummary: e.target.value })
                  }
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>상세 설명</Label>
                <Textarea
                  value={settingsForm.gameGuideContent}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, gameGuideContent: e.target.value })
                  }
                  rows={12}
                  placeholder="게임 참여 방법, 규칙, 포인트 안내 등을 입력하세요."
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label>대표 이미지 URL (선택)</Label>
                <Input
                  value={settingsForm.gameGuideImageUrl}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, gameGuideImageUrl: e.target.value })
                  }
                  placeholder="https://..."
                />
              </div>
              <Button type="submit" className="bg-[#E11936] hover:bg-[#B71C1C]">
                저장
              </Button>
            </form>
          )}

          {activeTab === "categories" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-[#666]">야구 굿즈 대분류 (모자, 유니폼 등)</p>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setEditingCategory(emptyCategory())}
                >
                  + 분류 추가
                </Button>
              </div>

              {editingCategory && (
                <div className="border border-[#E9E9E9] rounded-lg p-4 space-y-3 bg-[#FAFAFA]">
                  <h3 className="font-medium">{editingCategory.id ? "분류 수정" : "분류 등록"}</h3>
                  <Input
                    placeholder="분류명 (예: 모자)"
                    value={editingCategory.name ?? ""}
                    onChange={(e) =>
                      setEditingCategory({ ...editingCategory, name: e.target.value })
                    }
                  />
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
                    <span className="text-sm">노출</span>
                  </label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={() => saveCategoryMutation.mutate(editingCategory)}
                      className="bg-[#E11936] hover:bg-[#B71C1C]"
                    >
                      저장
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setEditingCategory(null)}>
                      취소
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center gap-3 p-3 border border-[#E9E9E9] rounded-lg"
                  >
                    <div className="w-14 h-14 rounded bg-[#F0F0F0] overflow-hidden flex-shrink-0">
                      {cat.imageUrl ? (
                        <img src={cat.imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-[#999]">
                          {cat.name.slice(0, 2)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{cat.name}</p>
                      <p className="text-xs text-[#888] truncate">{cat.description}</p>
                      <p className="text-xs text-[#888]">상품 {cat.productCount ?? 0}개</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingCategory(cat)}
                      >
                        수정
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-[#E11936]"
                        onClick={() => {
                          if (confirm(`"${cat.name}" 분류를 삭제할까요?`)) {
                            deleteCategoryMutation.mutate(cat.id);
                          }
                        }}
                      >
                        삭제
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "products" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-[#666]">분류별 굿즈 상품 (상세보기만, 결제 없음)</p>
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    setEditingProduct(emptyProduct(categories[0]?.id))
                  }
                  disabled={categories.length === 0}
                >
                  + 상품 추가
                </Button>
              </div>

              {editingProduct && (
                <div className="border border-[#E9E9E9] rounded-lg p-4 space-y-3 bg-[#FAFAFA]">
                  <h3 className="font-medium">{editingProduct.id ? "상품 수정" : "상품 등록"}</h3>
                  <Select
                    value={String(editingProduct.categoryId || "")}
                    onValueChange={(v) =>
                      setEditingProduct({ ...editingProduct, categoryId: parseInt(v, 10) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="분류 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="상품명"
                    value={editingProduct.name ?? ""}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, name: e.target.value })
                    }
                  />
                  <Input
                    placeholder="한줄 요약"
                    value={editingProduct.summary ?? ""}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, summary: e.target.value })
                    }
                  />
                  <Input
                    placeholder="가격 표시 (예: 29,000원) — 참고용"
                    value={editingProduct.priceLabel ?? ""}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, priceLabel: e.target.value })
                    }
                  />
                  <Input
                    placeholder="이미지 URL"
                    value={editingProduct.imageUrl ?? ""}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, imageUrl: e.target.value })
                    }
                  />
                  <Textarea
                    placeholder="상세 설명"
                    value={editingProduct.detailContent ?? ""}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, detailContent: e.target.value })
                    }
                    rows={6}
                  />
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={editingProduct.isActive ?? true}
                      onCheckedChange={(v) =>
                        setEditingProduct({ ...editingProduct, isActive: !!v })
                      }
                    />
                    <span className="text-sm">노출</span>
                  </label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={() => saveProductMutation.mutate(editingProduct)}
                      className="bg-[#E11936] hover:bg-[#B71C1C]"
                    >
                      저장
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setEditingProduct(null)}>
                      취소
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {products.map((p) => {
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
                          {cat?.name} {p.priceLabel && `· ${p.priceLabel}`}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingProduct(p)}
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
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
