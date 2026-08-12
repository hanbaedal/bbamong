import fs from "fs/promises";
import path from "path";
import {
  SYSTEM_MANUALS,
  SYSTEM_MANUALS_GITHUB_BRANCH,
  SYSTEM_MANUALS_GITHUB_DOCS_DIR,
  SYSTEM_MANUALS_GITHUB_REPO,
  getSystemManualById,
  type SystemManualEntry,
} from "../../shared/systemManuals";

function docsDir(): string {
  return path.resolve(process.cwd(), SYSTEM_MANUALS_GITHUB_DOCS_DIR);
}

export function githubBlobUrl(fileName: string): string {
  return `https://github.com/${SYSTEM_MANUALS_GITHUB_REPO}/blob/${SYSTEM_MANUALS_GITHUB_BRANCH}/${SYSTEM_MANUALS_GITHUB_DOCS_DIR}/${encodeURIComponent(fileName)}`;
}

export function githubRawUrl(fileName: string): string {
  return `https://raw.githubusercontent.com/${SYSTEM_MANUALS_GITHUB_REPO}/${SYSTEM_MANUALS_GITHUB_BRANCH}/${SYSTEM_MANUALS_GITHUB_DOCS_DIR}/${encodeURIComponent(fileName)}`;
}

export type SystemManualListItem = SystemManualEntry & {
  availableLocally: boolean;
  githubUrl: string;
  sizeBytes: number | null;
};

export async function listSystemManuals(): Promise<SystemManualListItem[]> {
  const dir = docsDir();
  const items: SystemManualListItem[] = [];
  for (const entry of SYSTEM_MANUALS) {
    const localPath = path.join(dir, entry.fileName);
    let availableLocally = false;
    let sizeBytes: number | null = null;
    try {
      const st = await fs.stat(localPath);
      availableLocally = st.isFile();
      sizeBytes = st.size;
    } catch {
      availableLocally = false;
    }
    items.push({
      ...entry,
      availableLocally,
      githubUrl: githubBlobUrl(entry.fileName),
      sizeBytes,
    });
  }
  return items;
}

async function fetchFromGitHub(fileName: string): Promise<Buffer> {
  const url = githubRawUrl(fileName);
  const headers: Record<string, string> = {
    Accept: "application/octet-stream",
    "User-Agent": "ppamong-admin-system-manuals",
  };
  const token = process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`GitHub에서 파일을 가져오지 못했습니다. (${res.status})`);
  }
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

/**
 * 로컬 docs/ 우선, 없거나 forceGithub면 GitHub raw에서 가져와 로컬에 저장 후 반환
 */
export async function resolveSystemManualFile(
  id: string,
  options?: { forceGithub?: boolean },
): Promise<{ entry: SystemManualEntry; buffer: Buffer; source: "local" | "github" }> {
  const entry = getSystemManualById(id);
  if (!entry) {
    throw new Error("매뉴얼을 찾을 수 없습니다.");
  }

  const localPath = path.join(docsDir(), entry.fileName);
  const forceGithub = Boolean(options?.forceGithub);

  if (!forceGithub) {
    try {
      const buffer = await fs.readFile(localPath);
      return { entry, buffer, source: "local" };
    } catch {
      /* fall through to GitHub */
    }
  }

  const buffer = await fetchFromGitHub(entry.fileName);
  try {
    await fs.mkdir(docsDir(), { recursive: true });
    await fs.writeFile(localPath, buffer);
  } catch (err) {
    console.warn("[SystemManuals] local cache write failed:", err);
  }
  return { entry, buffer, source: "github" };
}
