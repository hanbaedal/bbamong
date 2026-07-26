import fs from "fs/promises";
import path from "path";
import { createReadStream } from "fs";

export type AppReleaseKind = "user" | "manager";

export interface AppReleaseMeta {
  appKind: AppReleaseKind;
  label: string;
  fileName: string;
  versionLabel: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy?: string;
}

export interface AppReleaseManifest {
  user: AppReleaseMeta | null;
  manager: AppReleaseMeta | null;
}

const RELEASE_DIR = path.join(process.cwd(), "data", "app-releases");
const MANIFEST_PATH = path.join(RELEASE_DIR, "manifest.json");

const KIND_CONFIG: Record<
  AppReleaseKind,
  { label: string; storedFileName: string; downloadFileName: string }
> = {
  user: {
    label: "PPAMONG 사용자 앱",
    storedFileName: "ppamong-user.apk",
    downloadFileName: "PPAMONG-user.apk",
  },
  manager: {
    label: "PPAMONG 운영자 앱",
    storedFileName: "ppamong-manager.apk",
    downloadFileName: "PPAMONG-manager.apk",
  },
};

async function ensureReleaseDir(): Promise<void> {
  await fs.mkdir(RELEASE_DIR, { recursive: true });
}

async function readManifest(): Promise<AppReleaseManifest> {
  try {
    const raw = await fs.readFile(MANIFEST_PATH, "utf8");
    const parsed = JSON.parse(raw) as AppReleaseManifest;
    return {
      user: parsed.user ?? null,
      manager: parsed.manager ?? null,
    };
  } catch {
    return { user: null, manager: null };
  }
}

async function writeManifest(manifest: AppReleaseManifest): Promise<void> {
  await ensureReleaseDir();
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");
}

function storedFilePath(appKind: AppReleaseKind): string {
  return path.join(RELEASE_DIR, KIND_CONFIG[appKind].storedFileName);
}

export function isValidAppReleaseKind(value: string): value is AppReleaseKind {
  return value === "user" || value === "manager";
}

export function getAllowedAppReleaseExtensions(): string[] {
  return [".apk", ".aab"];
}

export async function listAppReleases(): Promise<AppReleaseManifest> {
  await ensureReleaseDir();
  const manifest = await readManifest();

  for (const kind of ["user", "manager"] as AppReleaseKind[]) {
    const meta = manifest[kind];
    if (!meta) continue;
    try {
      const stat = await fs.stat(storedFilePath(kind));
      manifest[kind] = { ...meta, sizeBytes: stat.size };
    } catch {
      manifest[kind] = null;
    }
  }

  return manifest;
}

export async function saveAppRelease(params: {
  appKind: AppReleaseKind;
  buffer: Buffer;
  originalFileName: string;
  versionLabel: string;
  uploadedBy?: string;
}): Promise<AppReleaseMeta> {
  const ext = path.extname(params.originalFileName).toLowerCase();
  if (!getAllowedAppReleaseExtensions().includes(ext)) {
    throw new Error("APK 또는 AAB 파일만 업로드할 수 있습니다.");
  }
  if (params.buffer.length === 0) {
    throw new Error("빈 파일은 업로드할 수 없습니다.");
  }
  if (params.buffer.length > 150 * 1024 * 1024) {
    throw new Error("파일 크기는 150MB 이하여야 합니다.");
  }

  await ensureReleaseDir();
  const targetPath = storedFilePath(params.appKind);
  await fs.writeFile(targetPath, params.buffer);

  const config = KIND_CONFIG[params.appKind];
  const meta: AppReleaseMeta = {
    appKind: params.appKind,
    label: config.label,
    fileName: config.downloadFileName,
    versionLabel: params.versionLabel.trim() || "미지정",
    sizeBytes: params.buffer.length,
    uploadedAt: new Date().toISOString(),
    uploadedBy: params.uploadedBy,
  };

  const manifest = await readManifest();
  manifest[params.appKind] = meta;
  await writeManifest(manifest);

  return meta;
}

export async function getAppReleaseFilePath(appKind: AppReleaseKind): Promise<{
  filePath: string;
  meta: AppReleaseMeta;
}> {
  const manifest = await listAppReleases();
  const meta = manifest[appKind];
  if (!meta) {
    throw new Error("등록된 앱 파일이 없습니다.");
  }

  const filePath = storedFilePath(appKind);
  await fs.access(filePath);
  return { filePath, meta };
}

export function createAppReleaseReadStream(filePath: string) {
  return createReadStream(filePath);
}

export function getAppReleaseKindLabel(appKind: AppReleaseKind): string {
  return KIND_CONFIG[appKind].label;
}
