import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ExternalLink, RefreshCw, Settings } from "lucide-react";
import AdminLayout from "./adminLayout";
import { Button } from "@/components/ui/button";
import { MALL_BASE_PATH } from "@shared/mallConfig";

export default function AdminMallPreviewPage() {
  const [, setLocation] = useLocation();
  const [refreshKey, setRefreshKey] = useState(0);

  const mallUrl = useMemo(() => {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    return `${base}${MALL_BASE_PATH}`;
  }, []);

  const iframeSrc = `${mallUrl}?adminPreview=1&_=${refreshKey}`;

  return (
    <AdminLayout>
      <div className="flex flex-col h-full min-h-0 -m-3 sm:-m-4 md:-m-6 lg:-m-8">
        <div className="shrink-0 px-3 sm:px-4 md:px-6 lg:px-8 pt-3 sm:pt-4 md:pt-6 lg:pt-8 pb-3 border-b border-[#E9E9E9] bg-white">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl md:text-2xl font-semibold text-[#201E22]">
                쇼핑몰 확인 (작업용)
              </h1>
              <p className="text-sm text-[#666] mt-1">
                운영 중인 쇼핑몰 화면을 관리자 페이지 안에서 바로 확인합니다. 매니저 앱에는
                쇼핑몰 메뉴가 없습니다.
              </p>
              <p className="text-xs text-[#888] mt-1 font-mono">{mallUrl}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRefreshKey((k) => k + 1)}
              >
                <RefreshCw className="w-4 h-4 mr-1.5" />
                새로고침
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => window.open(mallUrl, "_blank", "noopener,noreferrer")}
              >
                <ExternalLink className="w-4 h-4 mr-1.5" />
                새 탭에서 열기
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-[#E11936] hover:bg-[#B71C1C]"
                onClick={() => setLocation("/admin/mall-management")}
              >
                <Settings className="w-4 h-4 mr-1.5" />
                상품 관리
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 px-3 sm:px-4 md:px-6 lg:px-8 pb-3 sm:pb-4 md:pb-6 lg:pb-8 pt-3">
          <div className="h-full min-h-[480px] rounded-lg border border-[#E0E0E0] overflow-hidden bg-[#F5F5F5] shadow-inner">
            <iframe
              key={iframeSrc}
              title="PPAMONG 쇼핑몰 미리보기"
              src={iframeSrc}
              className="w-full h-full min-h-[480px] bg-white"
              referrerPolicy="same-origin"
            />
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
