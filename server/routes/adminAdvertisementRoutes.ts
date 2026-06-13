import type { Express } from "express";
import { AdminAdvertisementStorage } from "../storage/adminAdvertisementStorage";
import { insertAdvertisementSchema } from "../../shared/schema";
import { ObjectStorageService } from "../objectStorage";
import { adminAuthMiddleware } from "../middleware/adminAuth";

const adminAdvertisementStorage = new AdminAdvertisementStorage();

export async function adminAdvertisementRoutes(app: Express): Promise<void> {
  app.post("/api/admin/advertisements/upload", adminAuthMiddleware, async (req, res) => {
    try {
      const { fileExtension } = req.body;
      
      if (fileExtension && !/^\.[A-Za-z0-9]+$/.test(fileExtension)) {
        return res.status(400).json({ error: "유효하지 않은 파일 확장자입니다." });
      }
      
      const objectStorageService = new ObjectStorageService();
      const { uploadURL, canonicalPath } = await objectStorageService.getAdvertisementUploadURL(fileExtension);
      res.json({ uploadURL, canonicalPath });
    } catch (error) {
      console.error("광고 업로드 URL 생성 실패:", error);
      res.status(500).json({ error: "업로드 URL 생성에 실패했습니다." });
    }
  });

  app.get("/api/admin/advertisements", adminAuthMiddleware, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 8;

      const result = await adminAdvertisementStorage.getAllAdvertisements(page, limit);

      res.json(result);
    } catch (error) {
      console.error("광고 목록 조회 실패:", error);
      res.status(500).json({ message: "광고 목록 조회에 실패했습니다." });
    }
  });

  app.post("/api/admin/advertisements", adminAuthMiddleware, async (req, res) => {
    try {
      const validatedData = insertAdvertisementSchema.parse(req.body);
      
      const objectStorageService = new ObjectStorageService();
      const normalizedVideoUrl = objectStorageService.normalizeObjectEntityPath(validatedData.videoUrl);

      const newAdvertisement = await adminAdvertisementStorage.createAdvertisement({
        ...validatedData,
        videoUrl: normalizedVideoUrl,
      });

      res.status(201).json({ message: "광고가 등록되었습니다.", data: newAdvertisement });
    } catch (error: any) {
      console.error("광고 등록 실패:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ 
          error: "입력 데이터가 올바르지 않습니다.",
          details: error.errors,
        });
      }
      res.status(500).json({ message: "광고 등록에 실패했습니다." });
    }
  });

  app.put("/api/admin/advertisements/:id", adminAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      const validatedData = insertAdvertisementSchema.partial().parse(req.body);
      
      const objectStorageService = new ObjectStorageService();
      const dataToUpdate = { ...validatedData };
      if (dataToUpdate.videoUrl) {
        dataToUpdate.videoUrl = objectStorageService.normalizeObjectEntityPath(dataToUpdate.videoUrl);
      }

      const updatedAdvertisement = await adminAdvertisementStorage.updateAdvertisement(id, dataToUpdate);

      if (!updatedAdvertisement) {
        return res.status(404).json({ message: "광고를 찾을 수 없습니다." });
      }

      res.json({ message: "광고가 수정되었습니다.", data: updatedAdvertisement });
    } catch (error) {
      console.error("광고 수정 실패:", error);
      res.status(500).json({ message: "광고 수정에 실패했습니다." });
    }
  });

  app.delete("/api/admin/advertisements/:id", adminAuthMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      const deleted = await adminAdvertisementStorage.deleteAdvertisement(id);

      if (!deleted) {
        return res.status(404).json({ message: "광고를 찾을 수 없습니다." });
      }

      res.json({ message: "광고가 삭제되었습니다." });
    } catch (error) {
      console.error("광고 삭제 실패:", error);
      res.status(500).json({ message: "광고 삭제에 실패했습니다." });
    }
  });
}
