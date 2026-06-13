import type { Express } from "express";
import { AdminWaitingScreenStorage } from "../storage/adminWaitingScreenStorage";
import { insertWaitingScreenSchema } from "../../shared/schema";
import { ObjectStorageService } from "../objectStorage";
import { adminAuthMiddleware } from "../middleware/adminAuth";
import { broadcastManager } from "../liveMatch/broadcastManager";

const adminWaitingScreenStorage = new AdminWaitingScreenStorage();

export async function adminWaitingScreenRoutes(app: Express): Promise<void> {
  // 유저용: 모든 대기화면 가져오기 (인증 불필요)
  app.get("/api/waiting-screens", async (req, res) => {
    try {
      const result = await adminWaitingScreenStorage.getAllWaitingScreens(1, 1000);
      res.json(result.data);
    } catch (error) {
      console.error("대기화면 목록 조회 실패:", error);
      res.status(500).json({ message: "대기화면 목록 조회에 실패했습니다." });
    }
  });

  app.get("/api/admin/waiting-screens", adminAuthMiddleware, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 8;

      const result = await adminWaitingScreenStorage.getAllWaitingScreens(page, limit);

      res.json(result);
    } catch (error) {
      console.error("대기화면 목록 조회 실패:", error);
      res.status(500).json({ message: "대기화면 목록 조회에 실패했습니다." });
    }
  });

  app.post("/api/admin/waiting-screens", adminAuthMiddleware, async (req, res) => {
    try {
      const validatedData = insertWaitingScreenSchema.parse(req.body);

      const newScreen = await adminWaitingScreenStorage.createWaitingScreen(validatedData);

      // SSE로 모든 클라이언트에게 대기화면 변경 알림
      broadcastManager.broadcastToAll("waiting_screens_updated", {
        action: "created",
        message: "대기화면이 추가되었습니다."
      });

      res.status(201).json({ message: "대기화면이 등록되었습니다.", data: newScreen });
    } catch (error: any) {
      console.error("대기화면 등록 실패:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ 
          error: "입력 데이터가 올바르지 않습니다.",
          details: error.errors,
        });
      }
      res.status(500).json({ message: "대기화면 등록에 실패했습니다." });
    }
  });

  app.put("/api/admin/waiting-screens/:id", adminAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertWaitingScreenSchema.partial().parse(req.body);

      const updatedScreen = await adminWaitingScreenStorage.updateWaitingScreen(id, validatedData);

      if (!updatedScreen) {
        return res.status(404).json({ message: "대기화면을 찾을 수 없습니다." });
      }

      // SSE로 모든 클라이언트에게 대기화면 변경 알림
      broadcastManager.broadcastToAll("waiting_screens_updated", {
        action: "updated",
        message: "대기화면이 수정되었습니다."
      });

      res.json({ message: "대기화면이 수정되었습니다.", data: updatedScreen });
    } catch (error) {
      console.error("대기화면 수정 실패:", error);
      res.status(500).json({ message: "대기화면 수정에 실패했습니다." });
    }
  });

  app.delete("/api/admin/waiting-screens/:id", adminAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      const deleted = await adminWaitingScreenStorage.deleteWaitingScreen(id);

      if (!deleted) {
        return res.status(404).json({ message: "대기화면을 찾을 수 없습니다." });
      }

      // SSE로 모든 클라이언트에게 대기화면 변경 알림
      broadcastManager.broadcastToAll("waiting_screens_updated", {
        action: "deleted",
        message: "대기화면이 삭제되었습니다."
      });

      res.json({ message: "대기화면이 삭제되었습니다." });
    } catch (error) {
      console.error("대기화면 삭제 실패:", error);
      res.status(500).json({ message: "대기화면 삭제에 실패했습니다." });
    }
  });

  app.post("/api/objects/upload", adminAuthMiddleware, async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("업로드 URL 생성 실패:", error);
      res.status(500).json({ error: "업로드 URL 생성에 실패했습니다." });
    }
  });

  app.get("/objects/:objectPath(*)", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      console.log("Object request path:", req.path);
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      console.log("Object file found, getting signed URL");
      
      // Use signed URL redirect for production compatibility
      const signedURL = await objectStorageService.getSignedDownloadURL(objectFile, 3600);
      console.log("Redirecting to signed URL");
      res.redirect(302, signedURL);
    } catch (error: any) {
      console.error("파일 다운로드 실패:", error?.message || error);
      if (!res.headersSent) {
        return res.sendStatus(404);
      }
    }
  });
}
