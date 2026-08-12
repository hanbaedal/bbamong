import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import AdminLayout from "../adminLayout";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import { adminFetch } from "@/lib/adminQueryClient";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, BookOpen, Database } from "lucide-react";

interface SystemManualItem {
  id: string;
  category: "usage" | "db";
  audience: string;
  title: string;
  description: string;
  fileName: string;
  availableLocally: boolean;
  githubUrl: string;
  sizeBytes: number | null;
}

interface SystemManualsResponse {
  manuals: SystemManualItem[];
  githubRepo: string;
  githubBranch: string;
  docsPath: string;
}

function formatSize(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

async function downloadManual(id: string, fileName: string, source: "local" | "github") {
  const qs = source === "github" ? "?source=github" : "";
  const res = await adminFetch(`/api/admin/ops/system-manuals/${id}/download${qs}`);
  if (!res.ok) {
    let message = "다운로드에 실패했습니다.";
    try {
      const body = await res.json();
      if (typeof body?.error === "string") message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

function ManualCard({
  item,
  onDownload,
}: {
  item: SystemManualItem;
  onDownload: (item: SystemManualItem, source: "local" | "github") => void;
}) {
  return (
    <div
      className="rounded-xl border border-[#E5E5E5] bg-white p-4 shadow-sm flex flex-col gap-3"
      data-testid={`manual-card-${item.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="inline-block rounded bg-[#EEF4FF] px-2 py-0.5 text-[11px] font-semibold text-[#1A6DFF]">
            {item.audience}
          </span>
          <h3 className="mt-2 text-base font-semibold text-[#1A1A1A]">{item.title}</h3>
          <p className="mt-1 text-sm text-[#666] leading-relaxed">{item.description}</p>
        </div>
      </div>
      <p className="text-xs text-[#888] break-all">
        파일: <span className="font-mono text-[#444]">{item.fileName}</span>
        {" · "}
        {item.availableLocally ? `배포본 ${formatSize(item.sizeBytes)}` : "배포본 없음 → GitHub 필요"}
      </p>
      <div className="mt-auto flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className="bg-[#1A6DFF] hover:bg-[#1558D6]"
          onClick={() => onDownload(item, item.availableLocally ? "local" : "github")}
          data-testid={`button-download-${item.id}`}
        >
          <Download className="mr-1.5 h-4 w-4" />
          다운로드
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onDownload(item, "github")}
          data-testid={`button-github-fetch-${item.id}`}
        >
          GitHub에서 가져오기
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          asChild
        >
          <a href={item.githubUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="mr-1.5 h-4 w-4" />
            GitHub
          </a>
        </Button>
      </div>
    </div>
  );
}

export default function SystemManualsPage() {
  const { user, isUserLoaded } = useUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const isSuperAdmin = user?.userType === "슈퍼어드민";

  useEffect(() => {
    if (isUserLoaded && !isSuperAdmin) {
      setLocation("/admin/home");
    }
  }, [isUserLoaded, isSuperAdmin, setLocation]);

  const { data, isLoading, refetch, isFetching } = useQuery<SystemManualsResponse>({
    queryKey: ["/api/admin/ops/system-manuals"],
    queryFn: async () => {
      const res = await adminFetch("/api/admin/ops/system-manuals");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err?.error === "string" ? err.error : "목록 조회 실패");
      }
      return res.json();
    },
    enabled: isUserLoaded && isSuperAdmin,
  });

  const handleDownload = async (item: SystemManualItem, source: "local" | "github") => {
    try {
      await downloadManual(item.id, item.fileName, source);
      toast({
        description:
          source === "github"
            ? `GitHub에서 「${item.title}」을(를) 가져와 다운로드했습니다.`
            : `「${item.title}」 다운로드를 시작했습니다.`,
      });
      if (source === "github") void refetch();
    } catch (error) {
      toast({
        variant: "destructive",
        description: error instanceof Error ? error.message : "다운로드에 실패했습니다.",
      });
    }
  };

  const usage = data?.manuals.filter((m) => m.category === "usage") ?? [];
  const db = data?.manuals.filter((m) => m.category === "db") ?? [];

  if (!isUserLoaded || !isSuperAdmin) {
    return (
      <AdminLayout>
        <div className="p-6 text-sm text-[#888]">확인 중…</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 max-w-5xl mx-auto" data-testid="page-system-manuals">
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-[#1A1A1A]">시스템 매뉴얼</h1>
          <p className="mt-1 text-sm text-[#666]">
            GitHub <span className="font-mono">{data?.githubRepo ?? "hanbaedal/bbamong"}</span>
            {" / "}
            <span className="font-mono">{data?.docsPath ?? "docs"}</span>
            {" "}원본을 내려받습니다. 슈퍼바이저 전용입니다.
          </p>
        </div>

        {isLoading ? (
          <p className="text-sm text-[#888]">불러오는 중…</p>
        ) : (
          <div className="space-y-8">
            <section>
              <div className="mb-3 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-[#1A6DFF]" />
                <h2 className="text-lg font-semibold">1. 빠몽이 사용 설명서</h2>
                {isFetching ? <span className="text-xs text-[#999]">갱신 중…</span> : null}
              </div>
              <p className="mb-4 text-sm text-[#666]">
                관리자 페이지 · 쇼핑몰 · 운영자 · 사용자 부문으로 나뉩니다.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {usage.map((item) => (
                  <ManualCard key={item.id} item={item} onDownload={handleDownload} />
                ))}
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2">
                <Database className="h-5 w-5 text-[#00897B]" />
                <h2 className="text-lg font-semibold">2. 빠몽이 DB 구조 설명서</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {db.map((item) => (
                  <ManualCard key={item.id} item={item} onDownload={handleDownload} />
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
