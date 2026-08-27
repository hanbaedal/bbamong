import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import AdminLayout from "../adminLayout";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import { adminFetch } from "@/lib/adminQueryClient";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, BookOpen, Database, Eye, X, Loader2 } from "lucide-react";
import { SYSTEM_OPS_HANDBOOK_UPDATED } from "@shared/systemOpsHandbook";
import SystemManualsHandbook from "./SystemManualsHandbook";

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
  pdfFileName: string;
  pdfAvailableLocally: boolean;
  pdfSizeBytes: number | null;
  pdfGithubUrl: string;
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

async function fetchManualPdfBlob(id: string, source: "local" | "github"): Promise<Blob> {
  const qs = source === "github" ? "?source=github" : "";
  const res = await adminFetch(`/api/admin/ops/system-manuals/${id}/view${qs}`);
  if (!res.ok) {
    let message = "PDF를 불러오지 못했습니다.";
    try {
      const body = await res.json();
      if (typeof body?.error === "string") message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.blob();
}

function ManualPdfViewerModal({
  item,
  onClose,
  onRefetch,
}: {
  item: SystemManualItem;
  onClose: () => void;
  onRefetch: () => void;
}) {
  const { toast } = useToast();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const preferGithub = !item.pdfAvailableLocally;
        let blob: Blob;
        try {
          blob = await fetchManualPdfBlob(item.id, preferGithub ? "github" : "local");
        } catch (firstErr) {
          if (!preferGithub) {
            blob = await fetchManualPdfBlob(item.id, "github");
            if (!cancelled) onRefetch();
          } else {
            throw firstErr;
          }
        }
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "PDF를 불러오지 못했습니다.";
        setError(message);
        toast({ variant: "destructive", description: message });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [item.id, item.pdfAvailableLocally, onRefetch, toast]);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-3 sm:p-6"
      data-testid="manual-pdf-viewer-modal"
      role="dialog"
      aria-modal="true"
      aria-label={`${item.title} PDF 보기`}
    >
      <div className="flex h-[min(92vh,920px)] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-[#E8E8E8] px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#1A1A1A]">{item.title}</p>
            <p className="truncate text-xs text-[#888]">{item.pdfFileName}</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onClose}
            data-testid="button-close-pdf-viewer"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="relative min-h-0 flex-1 bg-[#F5F5F5]">
          {loading ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-[#666]">
              <Loader2 className="h-5 w-5 animate-spin" />
              PDF 불러오는 중…
            </div>
          ) : error ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-[#C62828]">{error}</p>
              <p className="text-xs text-[#888]">
                docs에 PDF가 없으면 DOCX를 PDF로 변환해 커밋하거나「GitHub에서 가져오기」를 확인하세요.
              </p>
            </div>
          ) : pdfUrl ? (
            <iframe
              title={item.title}
              src={`${pdfUrl}#toolbar=1&navpanes=0`}
              className="h-full w-full border-0"
              data-testid="iframe-manual-pdf"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ManualCard({
  item,
  onDownload,
  onRead,
}: {
  item: SystemManualItem;
  onDownload: (item: SystemManualItem, source: "local" | "github") => void;
  onRead: (item: SystemManualItem) => void;
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
        DOCX: <span className="font-mono text-[#444]">{item.fileName}</span>
        {" · "}
        {item.availableLocally ? `배포본 ${formatSize(item.sizeBytes)}` : "배포본 없음"}
      </p>
      <p className="text-xs text-[#888] break-all">
        PDF: <span className="font-mono text-[#444]">{item.pdfFileName}</span>
        {" · "}
        {item.pdfAvailableLocally ? `읽기용 ${formatSize(item.pdfSizeBytes)}` : "PDF 없음 → GitHub/변환 필요"}
      </p>
      <div className="mt-auto flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className="bg-[#00897B] hover:bg-[#00796B]"
          onClick={() => onRead(item)}
          data-testid={`button-read-${item.id}`}
        >
          <Eye className="mr-1.5 h-4 w-4" />
          읽기
        </Button>
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
        <Button type="button" size="sm" variant="ghost" asChild>
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
  const [readingItem, setReadingItem] = useState<SystemManualItem | null>(null);

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
            운영 기준({SYSTEM_OPS_HANDBOOK_UPDATED})을 이 화면에서 바로 보고, 사용 설명서 PDF를 읽거나
            DOCX로 받을 수 있습니다. GitHub{" "}
            <span className="font-mono">{data?.githubRepo ?? "hanbaedal/bbamong"}</span>
            {" / "}
            <span className="font-mono">{data?.docsPath ?? "docs"}</span>
          </p>
        </div>

        <SystemManualsHandbook />

        <div id="ops-files" className="mt-10 scroll-mt-4">
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
                  <ManualCard
                    key={item.id}
                    item={item}
                    onDownload={handleDownload}
                    onRead={setReadingItem}
                  />
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
                  <ManualCard
                    key={item.id}
                    item={item}
                    onDownload={handleDownload}
                    onRead={setReadingItem}
                  />
                ))}
              </div>
            </section>
          </div>
        )}
        </div>
      </div>

      {readingItem ? (
        <ManualPdfViewerModal
          item={readingItem}
          onClose={() => setReadingItem(null)}
          onRefetch={refetch}
        />
      ) : null}
    </AdminLayout>
  );
}
