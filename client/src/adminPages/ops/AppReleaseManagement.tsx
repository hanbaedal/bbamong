import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import AdminLayout from "../adminLayout";
import { useAdminAssets } from "@/contexts/AdminAssetContext";
import { useUser } from "@/contexts/UserContext";
import { adminFetch, getFullUrl } from "@/lib/adminQueryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

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
    return new Date(iso).toLocaleString("ko-KR");
  } catch {
    return iso;
  }
}

function ReleaseCard({
  kind,
  title,
  description,
  release,
  versionLabel,
  onVersionChange,
  onUpload,
  onDownload,
  uploading,
}: {
  kind: AppReleaseKind;
  title: string;
  description: string;
  release: AppReleaseMeta | null;
  versionLabel: string;
  onVersionChange: (value: string) => void;
  onUpload: (kind: AppReleaseKind, file: File) => void;
  onDownload: (kind: AppReleaseKind) => void;
  uploading: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="bg-white border border-[#E9E9E9] rounded-lg p-6">
      <h3 className="text-base font-semibold text-[#201E22] mb-1">{title}</h3>
      <p className="text-xs text-[#888] mb-4">{description}</p>

      {release ? (
        <div className="mb-4 p-3 rounded-lg bg-[#FAFAFA] border border-[#E9E9E9] text-sm space-y-1">
          <p>
            <span className="text-[#888]">버전:</span> {release.versionLabel}
          </p>
          <p>
            <span className="text-[#888]">파일:</span> {release.fileName} ({formatBytes(release.sizeBytes)})
          </p>
          <p>
            <span className="text-[#888]">등록:</span> {formatDate(release.uploadedAt)}
            {release.uploadedBy ? ` · ${release.uploadedBy}` : ""}
          </p>
        </div>
      ) : (
        <div className="mb-4 p-3 rounded-lg bg-[#FFF8E1] border border-[#FFE082] text-sm text-[#F57C00]">
          등록된 파일이 없습니다. APK/AAB를 업로드하세요.
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-[#666] mb-1">버전 표시 (선택)</label>
          <Input
            value={versionLabel}
            onChange={(e) => onVersionChange(e.target.value)}
            placeholder="예: 1.0.0"
            className="max-w-xs"
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
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? "업로드 중..." : release ? "새 파일로 교체" : "파일 등록"}
          </Button>
          <Button
            type="button"
            disabled={!release || uploading}
            onClick={() => onDownload(kind)}
          >
            다운로드
          </Button>
        </div>
      </div>
    </div>
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

  const isAdmin =
    user?.userType === "슈퍼어드민" || user?.userType === "일반어드민";

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
      a.download =
        appKind === "user" ? "PPAMONG-user.apk" : "PPAMONG-manager.apk";
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
      <div className="flex flex-col h-screen">
        <div className="flex-shrink-0">
          <div className="flex items-center gap-2 mb-6">
            <span className="text-sm text-[#BFBFBF]">업무 관리</span>
            <span className="text-sm text-[#BFBFBF]">&gt;</span>
            <span className="text-sm text-[#201E22]">앱 파일 등록/다운로드</span>
          </div>

          <h1 className="text-2xl font-semibold text-[#201E22] mb-2 flex items-center gap-2">
            <img src={assets.adTermIcon} className="w-8 h-8" alt="" />
            앱 파일 등록/다운로드
          </h1>
          <p className="text-sm text-[#888] mb-6">
            사용자·운영자 Android APK/AAB를 등록하고 관리자가 다운로드합니다. (최대 150MB)
          </p>
        </div>

        <div className="flex-1 overflow-y-auto pb-8 space-y-6">
          <div className="bg-white border border-[#E9E9E9] rounded-lg p-6">
            <h3 className="text-base font-semibold text-[#201E22] mb-1">GitHub Actions에서 가져오기</h3>
            <p className="text-xs text-[#888] mb-4">
              {githubStatus?.repo ?? "hanbaedal/bbamong"} · {githubStatus?.workflowName ?? "Build APKs"} 워크플로
              아티팩트(bamong-user-apk, bbamong-manager-apk)를 서버에 등록합니다.
              서버 Replit Secrets에 <code className="text-[#555]">GITHUB_TOKEN</code>이 필요합니다.
            </p>

            {githubStatus && (
              <div
                className={`mb-4 p-3 rounded-lg border text-sm ${
                  githubStatus.tokenConfigured && !githubStatus.message
                    ? "bg-[#F1F8E9] border-[#C5E1A5] text-[#33691E]"
                    : "bg-[#FFF3E0] border-[#FFE0B2] text-[#E65100]"
                }`}
              >
                <p>
                  GitHub 토큰: {githubStatus.tokenConfigured ? "설정됨" : "미설정"}
                  {githubStatus.latestRunId ? ` · 최신 성공 Run ID: ${githubStatus.latestRunId}` : ""}
                </p>
                {githubStatus.message ? <p className="mt-1">{githubStatus.message}</p> : null}
              </div>
            )}

            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-[#666] mb-1">
                  Actions Run ID (비우면 최신 성공 빌드)
                </label>
                <Input
                  value={githubRunId}
                  onChange={(e) => {
                    setGithubRunIdTouched(true);
                    setGithubRunId(e.target.value);
                  }}
                  placeholder={githubStatus?.latestRunId ?? "최신 성공 빌드 자동 선택"}
                  className="w-56"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={importGithubMutation.isPending || githubStatus?.tokenConfigured === false}
                onClick={() => importGithubMutation.mutate(githubRunId)}
              >
                {importGithubMutation.isPending ? "가져오는 중..." : "GitHub에서 APK 가져오기"}
              </Button>
              {githubStatus?.latestRunId ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-xs"
                  onClick={() => {
                    setGithubRunIdTouched(false);
                    setGithubRunId(githubStatus.latestRunId ?? "");
                  }}
                >
                  최신 Run ID 사용
                </Button>
              ) : null}
            </div>
          </div>

          {isLoading ? (
            <p className="text-sm text-[#888]">불러오는 중...</p>
          ) : (
            <>
              <ReleaseCard
                kind="user"
                title="사용자 앱 (PPAMONG)"
                description="회원용 앱 APK/AAB — GitHub Actions bbamong-user.apk 등"
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
                description="경기 운영용 앱 APK/AAB — GitHub Actions bbamong-manager.apk 등"
                release={releases?.manager ?? null}
                versionLabel={managerVersion}
                onVersionChange={setManagerVersion}
                onUpload={handleUpload}
                onDownload={handleDownload}
                uploading={uploadingKind === "manager"}
              />
            </>
          )}

          <div className="p-4 rounded-lg border border-[#E9E9E9] bg-[#FAFAFA] text-xs text-[#666] space-y-1">
            <p>· 슈퍼어드민·일반어드민이 접근할 수 있습니다.</p>
            <p>· 파일은 서버 디스크(data/app-releases)에 저장됩니다. Replit 재배포 시 유지되도록 볼륨/백업을 확인하세요.</p>
            <p>· Play Store 출시 전 내부 배포용으로 사용하세요.</p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
