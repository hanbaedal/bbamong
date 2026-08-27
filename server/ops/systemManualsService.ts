import fs from "fs/promises";
import path from "path";
import {
  SYSTEM_MANUALS,
  SYSTEM_MANUALS_GITHUB_BRANCH,
  SYSTEM_MANUALS_GITHUB_DOCS_DIR,
  SYSTEM_MANUALS_GITHUB_REPO,
  getSystemManualById,
  systemManualPdfFileName,
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
  pdfFileName: string;
  pdfAvailableLocally: boolean;
  pdfSizeBytes: number | null;
  pdfGithubUrl: string;
  isMarkdown: boolean;
};

async function statFile(
  filePath: string,
): Promise<{ available: boolean; sizeBytes: number | null }> {
  try {
    const st = await fs.stat(filePath);
    return { available: st.isFile(), sizeBytes: st.size };
  } catch {
    return { available: false, sizeBytes: null };
  }
}

export function isInlineReadable(fileName: string): boolean {
  const ext = path.extname(fileName).toLowerCase();
  return ext === ".md" || ext === ".html" || ext === ".txt";
}

export function contentTypeFor(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".md") return "text/markdown; charset=utf-8";
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".txt") return "text/plain; charset=utf-8";
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return "application/octet-stream";
}

export async function listSystemManuals(): Promise<SystemManualListItem[]> {
  const dir = docsDir();
  const items: SystemManualListItem[] = [];
  for (const entry of SYSTEM_MANUALS) {
    const pdfFileName = systemManualPdfFileName(entry.fileName);
    const source = await statFile(path.join(dir, entry.fileName));
    const pdf = isInlineReadable(entry.fileName)
      ? { available: false, sizeBytes: null }
      : await statFile(path.join(dir, pdfFileName));
    items.push({
      ...entry,
      availableLocally: source.available,
      githubUrl: githubBlobUrl(entry.fileName),
      sizeBytes: source.sizeBytes,
      pdfFileName,
      pdfAvailableLocally: pdf.available,
      pdfSizeBytes: pdf.sizeBytes,
      pdfGithubUrl: githubBlobUrl(pdfFileName),
      isMarkdown: entry.fileName.toLowerCase().endsWith(".md"),
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

export type SystemManualFormat = "docx" | "pdf" | "source";

/**
 * 로컬 docs/ 우선, 없거나 forceGithub면 GitHub raw에서 가져와 로컬에 저장 후 반환
 */
export async function resolveSystemManualFile(
  id: string,
  options?: { forceGithub?: boolean; format?: SystemManualFormat },
): Promise<{ entry: SystemManualEntry; fileName: string; buffer: Buffer; source: "local" | "github" }> {
  const entry = getSystemManualById(id);
  if (!entry) {
    throw new Error("매뉴얼을 찾을 수 없습니다.");
  }

  const format = options?.format ?? "source";
  const fileName =
    format === "pdf" && !isInlineReadable(entry.fileName)
      ? systemManualPdfFileName(entry.fileName)
      : entry.fileName;
  const localPath = path.join(docsDir(), fileName);
  const forceGithub = Boolean(options?.forceGithub);

  if (!forceGithub) {
    try {
      const buffer = await fs.readFile(localPath);
      return { entry, fileName, buffer, source: "local" };
    } catch {
      /* fall through to GitHub */
    }
  }

  const buffer = await fetchFromGitHub(fileName);
  try {
    await fs.mkdir(docsDir(), { recursive: true });
    await fs.writeFile(localPath, buffer);
  } catch (err) {
    console.warn("[SystemManuals] local cache write failed:", err);
  }
  return { entry, fileName, buffer, source: "github" };
}
