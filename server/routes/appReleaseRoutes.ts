import type { Express, Request, Response } from "express";
import multer from "multer";
import path from "path";
import { superAdminAuthMiddleware } from "../middleware/adminAuth";
import {
  createAppReleaseReadStream,
  getAppReleaseFilePath,
  isValidAppReleaseKind,
  listAppReleases,
  saveAppRelease,
} from "../storage/appReleaseStorage";
import { importAppReleasesFromGithubRun } from "../utils/githubActionsArtifacts";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 150 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".apk" || ext === ".aab") {
      cb(null, true);
      return;
    }
    cb(new Error("APK 또는 AAB 파일만 업로드할 수 있습니다."));
  },
});

function handleUploadError(err: unknown, res: Response): boolean {
  if (!err) return false;
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ error: "파일 크기는 150MB 이하여야 합니다." });
      return true;
    }
    res.status(400).json({ error: err.message });
    return true;
  }
  const message = err instanceof Error ? err.message : "업로드에 실패했습니다.";
  res.status(400).json({ error: message });
  return true;
}

export async function appReleaseRoutes(app: Express): Promise<void> {
  app.get("/api/admin/ops/app-releases", superAdminAuthMiddleware, async (_req, res) => {
    try {
      const releases = await listAppReleases();
      res.json({ releases });
    } catch (error) {
      console.error("[AppRelease] list error:", error);
      res.status(500).json({ error: "앱 파일 목록 조회에 실패했습니다." });
    }
  });

  app.post("/api/admin/ops/app-releases/import-github", superAdminAuthMiddleware, async (req, res) => {
    try {
      const runId = typeof req.body?.runId === "string" ? req.body.runId.trim() : undefined;
      const result = await importAppReleasesFromGithubRun({
        runId,
        uploadedBy: (req as any).admin?.email,
      });
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("[AppRelease] import-github error:", error);
      const message = error instanceof Error ? error.message : "GitHub Actions에서 가져오기에 실패했습니다.";
      res.status(400).json({ error: message });
    }
  });

  app.post(
    "/api/admin/ops/app-releases/:appKind/upload",
    superAdminAuthMiddleware,
    (req, res, next) => {
      upload.single("file")(req, res, (err) => {
        if (handleUploadError(err, res)) return;
        next();
      });
    },
    async (req: Request, res: Response) => {
      try {
        const appKind = req.params.appKind;
        if (!isValidAppReleaseKind(appKind)) {
          return res.status(400).json({ error: "appKind는 user 또는 manager 여야 합니다." });
        }

        const file = req.file;
        if (!file) {
          return res.status(400).json({ error: "업로드할 파일을 선택해주세요." });
        }

        const versionLabel =
          typeof req.body?.versionLabel === "string" ? req.body.versionLabel.trim() : "";

        const meta = await saveAppRelease({
          appKind,
          buffer: file.buffer,
          originalFileName: file.originalname,
          versionLabel,
          uploadedBy: (req as any).admin?.email,
        });

        res.json({ success: true, release: meta });
      } catch (error) {
        console.error("[AppRelease] upload error:", error);
        const message = error instanceof Error ? error.message : "업로드에 실패했습니다.";
        res.status(400).json({ error: message });
      }
    },
  );

  app.get(
    "/api/admin/ops/app-releases/:appKind/download",
    superAdminAuthMiddleware,
    async (req, res) => {
      try {
        const appKind = req.params.appKind;
        if (!isValidAppReleaseKind(appKind)) {
          return res.status(400).json({ error: "appKind는 user 또는 manager 여야 합니다." });
        }

        const { filePath, meta } = await getAppReleaseFilePath(appKind);
        res.setHeader("Content-Type", "application/vnd.android.package-archive");
        res.setHeader("Content-Disposition", `attachment; filename="${meta.fileName}"`);
        createAppReleaseReadStream(filePath).pipe(res);
      } catch (error) {
        console.error("[AppRelease] download error:", error);
        const message = error instanceof Error ? error.message : "다운로드에 실패했습니다.";
        res.status(404).json({ error: message });
      }
    },
  );
}
