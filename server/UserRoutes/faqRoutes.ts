import type { Express } from "express";
import { faqStorage as storage } from "../UserStorage/faqStorage";
import { insertFaqSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";

export async function faqRoutes(app: Express): Promise<void> {
  // 모든 FAQ 조회
  app.get("/api/faqs", async (req, res) => {
    try {
      const faqs = await storage.getAllFaqs();
      return res.json(faqs);
    } catch (error) {
      console.error("Get FAQs error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // 단일 FAQ 조회
  app.get("/api/faqs/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 ID 형식입니다." });
      }

      const faq = await storage.getFaq(id);
      if (!faq) {
        return res.status(404).json({ error: "FAQ를 찾을 수 없습니다." });
      }

      return res.json(faq);
    } catch (error) {
      console.error("Get FAQ error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // FAQ 생성
  app.post("/api/faqs", async (req, res) => {
    try {
      const result = insertFaqSchema.safeParse(req.body);

      if (!result.success) {
        const error = fromZodError(result.error);
        return res.status(400).json({ error: error.message });
      }

      const faq = await storage.createFaq(result.data);
      return res.status(201).json(faq);
    } catch (error) {
      console.error("Create FAQ error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // FAQ 수정
  app.patch("/api/faqs/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 ID 형식입니다." });
      }

      const result = insertFaqSchema.partial().safeParse(req.body);
      if (!result.success) {
        const error = fromZodError(result.error);
        return res.status(400).json({ error: error.message });
      }

      const faq = await storage.updateFaq(id, result.data);
      if (!faq) {
        return res.status(404).json({ error: "FAQ를 찾을 수 없습니다." });
      }

      return res.json(faq);
    } catch (error) {
      console.error("Update FAQ error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // FAQ 삭제
  app.delete("/api/faqs/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 ID 형식입니다." });
      }

      await storage.deleteFaq(id);
      return res.json({ success: true, message: "FAQ가 삭제되었습니다." });
    } catch (error) {
      console.error("Delete FAQ error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });
}
