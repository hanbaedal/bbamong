import { useEffect, useMemo, useState } from "react";
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
  isMarkdown?: boolean;
}

interface SystemManualsResponse {
  manuals: SystemManualItem[];
  githubRepo: string;
  githubBranch: string;
  docsPath: string;
}

function isMarkdownItem(item: SystemManualItem): boolean {
  return Boolean(item.isMarkdown) || item.fileName.toLowerCase().endsWith(".md");
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

async function fetchManualView(
  id: string,
  source: "local" | "github",
  asText: boolean,
): Promise<Blob | string> {
  const qs = source === "github" ? "?source=github" : "";
  const res = await adminFetch(`/api/admin/ops/system-manuals/${id}/view${qs}`);
  if (!res.ok) {
    let message = "문서를 불러오지 못했습니다.";
    try {
      const body = await res.json();
      if (typeof body?.error === "string") message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return asText ? res.text() : res.blob();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineMd(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, src) => {
      let url = src as string;
      if (url.startsWith("../assets/")) {
        url = `https://raw.githubusercontent.com/hanbaedal/bbamong/main/${url.replace(/^(?:\.\.\/)+/, "")}`;
      }
      return `<img alt="${escapeHtml(alt)}" src="${escapeHtml(url)}" />`;
    })
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

/** 표·제목·목록 위주. 상세 설명서 Markdown을 모달에서 읽기 위한 최소 변환 */
export function markdownToSafeHtml(md: string): string {
  const parts = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < parts.length) {
    const line = parts[i];
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const buf: string[] = [];
      i += 1;
      while (i < parts.length && !parts[i].startsWith("```")) {
        buf.push(parts[i]);
        i += 1;
      }
      i += 1;
      out.push(
        `<pre class="md-code" data-lang="${escapeHtml(lang)}"><code>${escapeHtml(buf.join("\n"))}</code></pre>`,
      );
      continue;
    }
    if (line.startsWith("|") && parts[i + 1]?.includes("---")) {
      const rows: string[][] = [];
      while (i < parts.length && parts[i].startsWith("|")) {
        const cells = parts[i]
          .split("|")
          .slice(1, -1)
          .map((c) => c.trim());
        if (!cells.every((c) => /^:?-{3,}:?$/.test(c))) rows.push(cells);
        i += 1;
      }
      if (rows.length) {
        const [head, ...body] = rows;
        out.push(
          `<div class="md-table-wrap"><table><thead><tr>${head
            .map((c) => `<th>${inlineMd(c)}</th>`)
            .join("")}</tr></thead><tbody>${body
            .map((r) => `<tr>${r.map((c) => `<td>${inlineMd(c)}</td>`).join("")}</tr>`)
            .join("")}</tbody></table></div>`,
        );
      }
      continue;
    }
    if (/^#{1,3} /.test(line)) {
      const level = line.startsWith("### ") ? 3 : line.startsWith("## ") ? 2 : 1;
      out.push(`<h${level}>${inlineMd(line.replace(/^#{1,3} /, ""))}</h${level}>`);
      i += 1;
      continue;
    }
    if (line.startsWith("> ")) {
      out.push(`<blockquote>${inlineMd(line.slice(2))}</blockquote>`);
      i += 1;
      continue;
    }
    if (line.startsWith("- ") || /^\d+\. /.test(line)) {
      const ordered = /^\d+\. /.test(line);
      const items: string[] = [];
      while (i < parts.length && (parts[i].startsWith("- ") || /^\d+\. /.test(parts[i]))) {
        items.push(parts[i].replace(/^(?:- |\d+\. )/, ""));
        i += 1;
      }
      const tag = ordered ? "ol" : "ul";
      out.push(`<${tag}>${items.map((it) => `<li>${inlineMd(it)}</li>`).join("")}</${tag}>`);
      continue;
    }
    if (!line.trim()) {
      i += 1;
      continue;
    }
    out.push(`<p>${inlineMd(line)}</p>`);
    i += 1;
  }
  return out.join("\n");
}

function ManualViewerModal({
  item,
  onClose,
  onRefetch,
}: {
  item: SystemManualItem;
  onClose: () => void;
  onRefetch: () => void;
}) {
  const { toast } = useToast();
  const markdown = isMarkdownItem(item);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [mdText, setMdText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const html = useMemo(() => (mdText ? markdownToSafeHtml(mdText) : ""), [mdText]);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      setMdText(null);
      setPdfUrl(null);
      try {
        const preferGithub = markdown ? !item.availableLocally : !item.pdfAvailableLocally;
        const loadOnce = (source: "local" | "github") =>
          fetchManualView(item.id, source, markdown);
        let payload: Blob | string;
        try {
          payload = await loadOnce(preferGithub ? "github" : "local");
        } catch (firstErr) {
          if (!preferGithub) {
            payload = await loadOnce("github");
            if (!cancelled) onRefetch();
          } else {
            throw firstErr;
          }
        }
        if (cancelled) return;
        if (markdown) {
          setMdText(typeof payload === "string" ? payload : await payload.text());
        } else {
          const blob = payload instanceof Blob ? payload : new Blob([payload], { type: "application/pdf" });
          objectUrl = URL.createObjectURL(blob);
          setPdfUrl(objectUrl);
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "문서를 불러오지 못했습니다.";
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
  }, [item.id, item.availableLocally, item.pdfAvailableLocally, markdown, onRefetch, toast]);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-3 sm:p-6"
      data-testid="manual-viewer-modal"
      role="dialog"
      aria-modal="true"
      aria-label={`${item.title} 보기`}
    >
      <div className="flex h-[min(92vh,920px)] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-[#E8E8E8] px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#1A1A1A]">{item.title}</p>
            <p className="truncate text-xs text-[#888]">
              {markdown ? item.fileName : item.pdfFileName}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onClose}
            data-testid="button-close-manual-viewer"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="relative min-h-0 flex-1 bg-[#F5F5F5]">
          {loading ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-[#666]">
              <Loader2 className="h-5 w-5 animate-spin" />
              불러오는 중…
            </div>
          ) : error ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-[#C62828]">{error}</p>
              <p className="text-xs text-[#888]">
                이 페이지 위 소제목에서도 같은 내용을 읽을 수 있습니다.
              </p>
            </div>
          ) : markdown && html ? (
            <div
              className="md-manual h-full overflow-auto bg-white p-5 text-sm leading-relaxed text-[#222]"
              data-testid="manual-markdown-body"
              dangerouslySetInnerHTML={{ __html: html }}
            />
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
      <style>{`
        .md-manual h1 { font-size: 1.35rem; font-weight: 700; margin: 0 0 12px; }
        .md-manual h2 { font-size: 1.15rem; font-weight: 700; margin: 24px 0 8px; }
        .md-manual h3 { font-size: 1rem; font-weight: 650; margin: 18px 0 6px; }
        .md-manual p, .md-manual li { margin: 6px 0; }
        .md-manual ul { list-style: disc; padding-left: 1.2rem; }
        .md-manual ol { list-style: decimal; padding-left: 1.2rem; }
        .md-manual code { background: #f1f5f9; padding: 0 4px; border-radius: 4px; font-size: 12px; }
        .md-manual pre.md-code { background: #0f172a; color: #e2e8f0; padding: 12px; border-radius: 8px; overflow: auto; font-size: 12px; }
        .md-manual img { max-width: 100%; height: auto; border-radius: 8px; margin: 8px 0; border: 1px solid #e5e7eb; }
        .md-manual blockquote { border-left: 3px solid #f59e0b; padding: 4px 10px; color: #92400e; background: #fffbeb; }
        .md-table-wrap { overflow-x: auto; margin: 10px 0; }
        .md-manual table { border-collapse: collapse; width: 100%; font-size: 13px; }
        .md-manual th, .md-manual td { border: 1px solid #dbe4f0; padding: 6px 8px; text-align: left; vertical-align: top; }
        .md-manual th { background: #eef4ff; }
      `}</style>
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
  const md = isMarkdownItem(item);
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
          {md ? (
            <span className="ml-1 inline-block rounded bg-[#ECFDF5] px-2 py-0.5 text-[11px] font-semibold text-[#047857]">
              Markdown 상세
            </span>
          ) : (
            <span className="ml-1 inline-block rounded bg-[#F4F4F5] px-2 py-0.5 text-[11px] font-semibold text-[#71717A]">
              DOCX 약식
            </span>
          )}
          <h3 className="mt-2 text-base font-semibold text-[#1A1A1A]">{item.title}</h3>
          <p className="mt-1 text-sm text-[#666] leading-relaxed">{item.description}</p>
        </div>
      </div>
      <p className="text-xs text-[#888] break-all">
        파일: <span className="font-mono text-[#444]">{item.fileName}</span>
        {" · "}
        {item.availableLocally ? `배포본 ${formatSize(item.sizeBytes)}` : "배포본 없음"}
      </p>
      {md ? null : (
        <p className="text-xs text-[#888] break-all">
          PDF: <span className="font-mono text-[#444]">{item.pdfFileName}</span>
          {" · "}
          {item.pdfAvailableLocally ? `읽기용 ${formatSize(item.pdfSizeBytes)}` : "PDF 없음 → GitHub/변환 필요"}
        </p>
      )}
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
      <div className="p-4 sm:p-6 max-w-6xl mx-auto" data-testid="page-system-manuals">
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-[#1A1A1A]">시스템 매뉴얼</h1>
          <p className="mt-1 text-sm text-[#666]">
            위 소제목(흐름도·운영자·사용자·DB)에서 바로 읽고, 각 장은 HTML로 받습니다. 아래 카드는
            Markdown 상세본과 예전 DOCX 약식입니다. 기준 {SYSTEM_OPS_HANDBOOK_UPDATED}. GitHub{" "}
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
                  <h2 className="text-lg font-semibold">파일로 읽기 · 다운로드</h2>
                  {isFetching ? <span className="text-xs text-[#999]">갱신 중…</span> : null}
                </div>
                <p className="mb-4 text-sm text-[#666]">
                  Markdown은 이 화면 소제목과 같은 상세본입니다. DOCX는 구버전 약식입니다.
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
                  <h2 className="text-lg font-semibold">DB 구조 파일</h2>
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
        <ManualViewerModal
          item={readingItem}
          onClose={() => setReadingItem(null)}
          onRefetch={refetch}
        />
      ) : null}
    </AdminLayout>
  );
}
