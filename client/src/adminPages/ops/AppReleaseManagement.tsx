import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Download, RefreshCw, Smartphone, Upload } from "lucide-react";
import AdminLayout from "../adminLayout";
import AdminPageShell from "../components/AdminPageShell";
import { useAdminAssets } from "@/contexts/AdminAssetContext";
import { useUser } from "@/contexts/UserContext";
import { adminFetch, getFullUrl } from "@/lib/adminQueryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type AppReleaseKind = "user" | "manager";

interface AppReleaseMeta {
  appKind: AppReleaseKind;
  label: string;
  fileName: string;
  versionLabel: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy?: string;
}

interface GithubImportStatus {
  tokenConfigured: boolean;
  repo: string;
  workflowName: string;
  workflowFile: string;
  latestRunId: string | null;
  message?: string;
}

interface AppReleaseManifest {
  user: AppReleaseMeta | null;
  manager: AppReleaseMeta | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

const APP_KIND_META: Record<
  AppReleaseKind,
  { badge: string; accent: string; border: string; iconBg: string }
> = {
  user: {
    badge: "회원 앱",
    accent: "text-[#1565C0]",
    border: "border-[#BBDEFB]",
    iconBg: "bg-[#E3F2FD]",
  },
  manager: {
    badge: "운영자 앱",
    accent: "text-[#E11936]",
    border: "border-[#FFCDD2]",
    iconBg: "bg-[#FFF5F6]",
  },
};

function ReleaseCard({
  kind,
  title,
  release,
  versionLabel,
  onVersionChange,
  onUpload,
  onDownload,
  uploading,
}: {
  kind: AppReleaseKind;
  title: string;
  release: AppReleaseMeta | null;
  versionLabel: string;
  onVersionChange: (value: string) => void;
  onUpload: (kind: AppReleaseKind, file: File) => void;
  onDownload: (kind: AppReleaseKind) => void;
  uploading: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const meta = APP_KIND_META[kind];

  return (
    <article
      className={cn(
        "flex flex-col h-full rounded-xl border bg-white p-4 lg:p-5 shadow-sm",
        meta.border,
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", meta.iconBg)}>
            <Smartphone className={cn("h-5 w-5", meta.accent)} />
          </div>
          <div className="min-w-0">
            <span className={cn("text-[10px] font-semibold uppercase tracking-wide", meta.accent)}>
              {meta.badge}
            </span>
            <h3 className="text-sm font-semibold text-[#201E22] leading-snug truncate">{title}</h3>
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
            release ? "bg-[#E8F5E9] text-[#2E7D32]" : "bg-[#F5F5F5] text-[#888]",
          )}
        >
          {release ? "등록됨" : "미등록"}
        </span>
      </div>

      {release ? (
        <dl className="mb-4 grid grid-cols-[56px_1fr] gap-x-2 gap-y-1.5 rounded-lg bg-[#FAFAFA] border border-[#F0F0F0] p-3 text-xs">
          <dt className="text-[#888]">버전</dt>
          <dd className="text-[#201E22] font-medium">{release.versionLabel || "—"}</dd>
          <dt className="text-[#888]">파일</dt>
          <dd className="text-[#201E22] truncate" title={release.fileName}>
            {release.fileName}
          </dd>
          <dt className="text-[#888]">크기</dt>
          <dd className="text-[#201E22] tabular-nums">{formatBytes(release.sizeBytes)}</dd>
          <dt className="text-[#888]">등록</dt>
          <dd className="text-[#201E22] tabular-nums">
            {formatDate(release.uploadedAt)}
            {release.uploadedBy ? ` · ${release.uploadedBy}` : ""}
          </dd>
        </dl>
      ) : (
        <div className="mb-4 rounded-lg border border-dashed border-[#E0E0E0] bg-[#FAFAFA] px-3 py-6 text-center text-xs text-[#888]">
          등록된 APK/AAB가 없습니다
        </div>
      )}

      <div className="mt-auto space-y-3">
        <div>
          <label className="block text-[11px] font-medium text-[#666] mb-1">버전 표시 (선택)</label>
          <Input
            value={versionLabel}
            onChange={(e) => onVersionChange(e.target.value)}
            placeholder="1.0.0"
            className="h-8 text-xs"
          />
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".apk,.aab,application/vnd.android.package-archive"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(kind, file);
            e.target.value = "";
          }}
        />

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            className="h-8 text-xs gap-1.5 flex-1 sm:flex-none"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            {uploading ? "업로드 중..." : release ? "교체" : "등록"}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!release || uploading}
            className="h-8 text-xs gap-1.5 flex-1 sm:flex-none"
            onClick={() => onDownload(kind)}
          >
            <Download className="h-3.5 w-3.5" />
            다운로드
          </Button>
        </div>
      </div>
    </article>
  );
}

function GithubImportCard({
  githubStatus,
  githubRunId,
  onRunIdChange,
  onUseLatestRunId,
  onImport,
  importing,
}: {
  githubStatus: GithubImportStatus | undefined;
  githubRunId: string;
  onRunIdChange: (value: string, touched: boolean) => void;
  onUseLatestRunId: () => void;
  onImport: () => void;
  importing: boolean;
}) {
  const tokenOk = githubStatus?.tokenConfigured && !githubStatus.message;

  return (
    <section className="rounded-xl border border-[#E9E9E9] bg-white p-4 lg:p-5 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F3E5F5]">
            <RefreshCw className="h-5 w-5 text-[#7B1FA2]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#201E22]">GitHub Actions에서 가져오기</h2>
            {githubStatus && (
              <p className="text-[11px] text-[#888] mt-0.5">
                {githubStatus.repo} · {githubStatus.workflowName}
              </p>
            )}
          </div>
        </div>

        {githubStatus && (
          <span
            className={cn(
              "inline-flex self-start lg:self-center rounded-full px-2.5 py-1 text-[11px] font-medium",
              tokenOk ? "bg-[#E8F5E9] text-[#2E7D32]" : "bg-[#FFF3E0] text-[#E65100]",
            )}
          >
            GitHub 토큰 {githubStatus.tokenConfigured ? "설정됨" : "미설정"}
            {githubStatus.latestRunId ? ` · Run ${githubStatus.latestRunId}` : ""}
          </span>
        )}
      </div>

      {githubStatus?.message ? (
        <p className="mb-3 text-xs text-[#E65100] rounded-lg bg-[#FFF8E1] border border-[#FFE082] px-3 py-2">
          {githubStatus.message}
        </p>
      ) : null}

      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3">
        <div className="flex-1 min-w-[200px] max-w-sm">
          <label className="block text-[11px] font-medium text-[#666] mb-1">
            Actions Run ID (비우면 최신 성공 빌드)
          </label>
          <Input
            value={githubRunId}
            onChange={(e) => onRunIdChange(e.target.value, true)}
            placeholder={githubStatus?.latestRunId ?? "자동 선택"}
            className="h-8 text-xs"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={importing || githubStatus?.tokenConfigured === false}
            onClick={onImport}
          >
            {importing ? "가져오는 중..." : "APK 가져오기"}
          </Button>
          {githubStatus?.latestRunId ? (
            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={onUseLatestRunId}>
              최신 Run ID
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default function AppReleaseManagementPage() {
  const { user, isUserLoaded } = useUser();
  const [, setLocation] = useLocation();
  const { assets } = useAdminAssets();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [userVersion, setUserVersion] = useState("");
  const [managerVersion, setManagerVersion] = useState("");
  const [uploadingKind, setUploadingKind] = useState<AppReleaseKind | null>(null);
  const [githubRunId, setGithubRunId] = useState("");
  const [githubRunIdTouched, setGithubRunIdTouched] = useState(false);

  const isAdmin = user?.userType === "슈퍼어드민" || user?.userType === "일반어드민";

  useEffect(() => {
    if (isUserLoaded && !isAdmin) {
      setLocation("/admin/login");
    }
  }, [isUserLoaded, isAdmin, setLocation]);

  const { data: githubStatus } = useQuery<GithubImportStatus>({
    queryKey: ["/api/admin/ops/app-releases/github-import-status"],
    queryFn: async () => {
      const res = await adminFetch("/api/admin/ops/app-releases/github-import-status");
      if (!res.ok) throw new Error("GitHub 연동 상태 조회 실패");
      return res.json();
    },
    enabled: isUserLoaded && isAdmin,
  });

  useEffect(() => {
    if (githubRunIdTouched || !githubStatus?.latestRunId) return;
    setGithubRunId(githubStatus.latestRunId);
  }, [githubStatus?.latestRunId, githubRunIdTouched]);

  const { data, isLoading } = useQuery<{ releases: AppReleaseManifest }>({
    queryKey: ["/api/admin/ops/app-releases"],
    queryFn: async () => {
      const res = await adminFetch("/api/admin/ops/app-releases");
      if (!res.ok) throw new Error("앱 파일 목록 조회 실패");
      return res.json();
    },
    enabled: isUserLoaded && isAdmin,
  });

  const uploadMutation = useMutation({
    mutationFn: async ({
      appKind,
      file,
      versionLabel,
    }: {
      appKind: AppReleaseKind;
      file: File;
      versionLabel: string;
    }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("versionLabel", versionLabel);

      const res = await fetch(getFullUrl(`/api/admin/ops/app-releases/${appKind}/upload`), {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "업로드에 실패했습니다.");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ops/app-releases"] });
      toast({
        description: `${variables.appKind === "user" ? "사용자" : "운영자"} 앱 파일이 등록되었습니다.`,
      });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "업로드에 실패했습니다.";
      toast({ variant: "destructive", description: message });
    },
    onSettled: () => setUploadingKind(null),
  });

  const importGithubMutation = useMutation({
    mutationFn: async (runId: string) => {
      const res = await adminFetch("/api/admin/ops/app-releases/import-github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: runId.trim() || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "GitHub Actions에서 가져오기에 실패했습니다.");
      }
      return res.json() as Promise<{
        runId: string;
        imported: AppReleaseMeta[];
        skipped: string[];
      }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ops/app-releases"] });
      const skippedNote =
        result.skipped.length > 0 ? ` (건너뜀: ${result.skipped.join(", ")})` : "";
      toast({
        description: `GitHub Actions run ${result.runId}에서 ${result.imported.length}개 APK를 등록했습니다.${skippedNote}`,
      });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "GitHub Actions에서 가져오기에 실패했습니다.";
      toast({ variant: "destructive", description: message });
    },
  });

  const handleUpload = (appKind: AppReleaseKind, file: File) => {
    const versionLabel = appKind === "user" ? userVersion : managerVersion;
    setUploadingKind(appKind);
    uploadMutation.mutate({ appKind, file, versionLabel });
  };

  const handleDownload = async (appKind: AppReleaseKind) => {
    try {
      const res = await adminFetch(`/api/admin/ops/app-releases/${appKind}/download`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "다운로드에 실패했습니다.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = appKind === "user" ? "PPAMONG-user.apk" : "PPAMONG-manager.apk";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "다운로드에 실패했습니다.";
      toast({ variant: "destructive", description: message });
    }
  };

  if (!isUserLoaded || !isAdmin) {
    return null;
  }

  const releases = data?.releases;

  return (
    <AdminLayout>
      <AdminPageShell
        title="앱 파일 등록/다운로드"
        icon={<img src={assets.adTermIcon} className="w-7 h-7 lg:w-8 lg:h-8" alt="" />}
      >
        <div className="space-y-4 max-w-5xl">
          <GithubImportCard
            githubStatus={githubStatus}
            githubRunId={githubRunId}
            onRunIdChange={(value, touched) => {
              if (touched) setGithubRunIdTouched(true);
              setGithubRunId(value);
            }}
            onUseLatestRunId={() => {
              setGithubRunIdTouched(false);
              setGithubRunId(githubStatus?.latestRunId ?? "");
            }}
            onImport={() => importGithubMutation.mutate(githubRunId)}
            importing={importGithubMutation.isPending}
          />

          {isLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="h-64 rounded-xl border border-[#E9E9E9] bg-[#FAFAFA] animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
              <ReleaseCard
                kind="user"
                title="사용자 앱 (PPAMONG)"
                release={releases?.user ?? null}
                versionLabel={userVersion}
                onVersionChange={setUserVersion}
                onUpload={handleUpload}
                onDownload={handleDownload}
                uploading={uploadingKind === "user"}
              />
              <ReleaseCard
                kind="manager"
                title="운영자 앱 (PPAMONG 매니저)"
                release={releases?.manager ?? null}
                versionLabel={managerVersion}
                onVersionChange={setManagerVersion}
                onUpload={handleUpload}
                onDownload={handleDownload}
                uploading={uploadingKind === "manager"}
              />
            </div>
          )}
        </div>
      </AdminPageShell>
    </AdminLayout>
  );
}
