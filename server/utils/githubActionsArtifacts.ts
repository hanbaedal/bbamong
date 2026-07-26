import AdmZip from "adm-zip";
import {
  saveAppRelease,
  type AppReleaseKind,
  type AppReleaseMeta,
} from "../storage/appReleaseStorage";

const DEFAULT_OWNER = "hanbaedal";
const DEFAULT_REPO = "bbamong";
const WORKFLOW_NAME = "Build APKs";

const ARTIFACT_TO_KIND: Record<string, AppReleaseKind> = {
  "bbamong-user-apk": "user",
  "bbamong-manager-apk": "manager",
};

export interface GithubArtifactInfo {
  id: number;
  name: string;
  size_in_bytes: number;
  archive_download_url: string;
  expired: boolean;
  workflow_run?: {
    head_branch?: string;
    head_sha?: string;
  };
}

export interface GithubRunArtifactsResponse {
  total_count: number;
  artifacts: GithubArtifactInfo[];
}

export interface ImportGithubRunResult {
  runId: string;
  imported: AppReleaseMeta[];
  skipped: string[];
}

function resolveGithubRepo(options?: { owner?: string; repo?: string }) {
  return {
    owner: options?.owner ?? process.env.GITHUB_REPO_OWNER?.trim() ?? DEFAULT_OWNER,
    repo: options?.repo ?? process.env.GITHUB_REPO_NAME?.trim() ?? DEFAULT_REPO,
  };
}

function resolveWorkflowFile(): string {
  const fromEnv = process.env.GITHUB_WORKFLOW_FILE?.trim();
  return fromEnv || "build-apk.yml";
}

export function isGithubTokenConfigured(): boolean {
  return Boolean(process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim());
}

function getGithubToken(): string {
  const token = process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "GITHUB_TOKEN 또는 GH_TOKEN 환경 변수가 필요합니다. Replit Secrets(또는 .env)에 PAT를 설정하세요. private repo면 repo 권한, public repo면 actions:read 권한이 필요합니다.",
    );
  }
  return token;
}

function formatGithubApiError(status: number, body: string): string {
  if (status === 401) {
    return "GitHub 토큰이 유효하지 않습니다. GITHUB_TOKEN을 다시 발급·설정하세요.";
  }
  if (status === 403) {
    return "GitHub API 접근이 거부되었습니다. 토큰에 actions:read(및 private repo면 repo) 권한이 있는지 확인하세요.";
  }
  if (status === 404) {
    return "GitHub Actions run을 찾을 수 없습니다. Run ID를 확인하거나 비워 두고 최신 성공 빌드를 사용하세요.";
  }
  return `GitHub API 오류 (${status}): ${body || "알 수 없는 오류"}`;
}

async function githubFetch<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(formatGithubApiError(res.status, body));
  }

  return res.json() as Promise<T>;
}

export async function fetchRunArtifacts(
  runId: string,
  options?: { owner?: string; repo?: string; token?: string },
): Promise<GithubRunArtifactsResponse> {
  const { owner, repo } = resolveGithubRepo(options);
  const token = options?.token ?? getGithubToken();
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/artifacts`;
  return githubFetch<GithubRunArtifactsResponse>(url, token);
}

export async function fetchLatestSuccessfulBuildRunId(
  options?: { owner?: string; repo?: string; token?: string },
): Promise<string | null> {
  const { owner, repo } = resolveGithubRepo(options);
  const token = options?.token ?? getGithubToken();
  const workflowFile = resolveWorkflowFile();
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/runs?status=success&per_page=1`;
  const data = await githubFetch<{ workflow_runs: Array<{ id: number }> }>(url, token);
  const latest = data.workflow_runs?.[0];
  return latest ? String(latest.id) : null;
}

export interface GithubImportStatus {
  tokenConfigured: boolean;
  repo: string;
  workflowName: string;
  workflowFile: string;
  latestRunId: string | null;
  message?: string;
}

export async function getGithubImportStatus(): Promise<GithubImportStatus> {
  const { owner, repo } = resolveGithubRepo();
  const workflowFile = resolveWorkflowFile();
  const base: GithubImportStatus = {
    tokenConfigured: isGithubTokenConfigured(),
    repo: `${owner}/${repo}`,
    workflowName: WORKFLOW_NAME,
    workflowFile,
    latestRunId: null,
  };

  if (!base.tokenConfigured) {
    return {
      ...base,
      message:
        "GITHUB_TOKEN이 설정되지 않았습니다. Replit Secrets 또는 .env에 PAT(actions:read, private repo면 repo)를 추가하세요.",
    };
  }

  try {
    const latestRunId = await fetchLatestSuccessfulBuildRunId({ owner, repo });
    return {
      ...base,
      latestRunId,
      message: latestRunId
        ? undefined
        : "Build APKs 워크플로의 성공 실행 기록을 찾지 못했습니다. GitHub Actions에서 먼저 빌드를 실행하세요.",
    };
  } catch (error) {
    return {
      ...base,
      message: error instanceof Error ? error.message : "GitHub 상태 확인에 실패했습니다.",
    };
  }
}

async function downloadArtifactZip(artifact: GithubArtifactInfo, token: string): Promise<Buffer> {
  const res = await fetch(artifact.archive_download_url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!res.ok) {
    throw new Error(`아티팩트 다운로드 실패 (${artifact.name}): HTTP ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function extractApkFromZip(zipBuffer: Buffer): { buffer: Buffer; originalFileName: string } {
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries().filter((entry) => !entry.isDirectory);
  const apkEntry =
    entries.find((entry) => entry.entryName.toLowerCase().endsWith(".apk")) ?? entries[0];

  if (!apkEntry) {
    throw new Error("ZIP 안에 APK 파일을 찾을 수 없습니다.");
  }

  return {
    buffer: apkEntry.getData(),
    originalFileName: apkEntry.entryName.split("/").pop() || "app.apk",
  };
}

function buildVersionLabel(artifact: GithubArtifactInfo, runId: string): string {
  const sha = artifact.workflow_run?.head_sha?.slice(0, 7);
  const branch = artifact.workflow_run?.head_branch;
  if (sha && branch) return `${branch}@${sha}`;
  if (sha) return sha;
  return `actions-run-${runId}`;
}

export async function importAppReleasesFromGithubRun(params: {
  runId?: string;
  uploadedBy?: string;
  owner?: string;
  repo?: string;
  token?: string;
}): Promise<ImportGithubRunResult> {
  const token = params.token ?? getGithubToken();
  const runId =
    params.runId?.trim() ||
    (await fetchLatestSuccessfulBuildRunId({
      owner: params.owner,
      repo: params.repo,
      token,
    }));

  if (!runId) {
    throw new Error("가져올 GitHub Actions 실행(run)을 찾을 수 없습니다.");
  }

  const { artifacts } = await fetchRunArtifacts(runId, {
    owner: params.owner,
    repo: params.repo,
    token,
  });

  const imported: AppReleaseMeta[] = [];
  const skipped: string[] = [];

  for (const artifact of artifacts) {
    const appKind = ARTIFACT_TO_KIND[artifact.name];
    if (!appKind) {
      skipped.push(`${artifact.name} (지원하지 않는 아티팩트)`);
      continue;
    }
    if (artifact.expired) {
      skipped.push(`${artifact.name} (만료됨)`);
      continue;
    }

    const zipBuffer = await downloadArtifactZip(artifact, token);
    const { buffer, originalFileName } = extractApkFromZip(zipBuffer);
    const meta = await saveAppRelease({
      appKind,
      buffer,
      originalFileName,
      versionLabel: buildVersionLabel(artifact, runId),
      uploadedBy: params.uploadedBy ?? `github-actions:${runId}`,
    });
    imported.push(meta);
  }

  if (imported.length === 0) {
    throw new Error(
      skipped.length > 0
        ? `가져올 APK가 없습니다. (${skipped.join(", ")})`
        : "해당 run에 bbamong-user-apk / bbamong-manager-apk 아티팩트가 없습니다.",
    );
  }

  return { runId, imported, skipped };
}

export function getDefaultGithubRepoLabel(): string {
  const { owner, repo } = resolveGithubRepo();
  return `${owner}/${repo}`;
}

export function getDefaultWorkflowName(): string {
  return WORKFLOW_NAME;
}
