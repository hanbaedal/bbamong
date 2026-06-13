import type { Express } from "express";
import { AdminUserStorage } from "../storage/adminUserStorage";
import { adminAuthMiddleware } from "../middleware/adminAuth";
import { deleteSession } from "../sessionManager";

const adminUserStorage = new AdminUserStorage();

export async function adminUserRoutes(app: Express): Promise<void> {
  app.get("/api/admin/regular-users", adminAuthMiddleware, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 8;
      const offset = (page - 1) * limit;

      const regularUsers = await adminUserStorage.getRegularUsersPaginated(
        limit,
        offset,
      );

      const total = await adminUserStorage.getRegularUsersCount();
      const suspendedTotal = await adminUserStorage.getRegularSuspendedUsersCount();

      const usersWithoutPassword = regularUsers.map(
        ({ password, verificationCode, ...user }) => user,
      );

      return res.json({
        data: usersWithoutPassword,
        total,
        suspendedTotal,
      });
    } catch (error) {
      console.error("Get regular users error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.get("/api/admin/suspended-users", adminAuthMiddleware, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 8;
      const offset = (page - 1) * limit;

      const regularUsers = await adminUserStorage.getSuspendedUsersPaginated(
        limit,
        offset,
      );

      const total = await adminUserStorage.getRegularUsersCount();
      const suspendedTotal = await adminUserStorage.getRegularSuspendedUsersCount();

      const usersWithoutPassword = regularUsers.map(
        ({ password, verificationCode, ...user }) => user,
      );

      return res.json({
        data: usersWithoutPassword,
        total,
        suspendedTotal,
      });
    } catch (error) {
      console.error("Get regular users error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.delete("/api/admin/regular-users/:id", adminAuthMiddleware, async (req, res) => {
    try {
      const { id } = req.params;

      const updatedUser = await adminUserStorage.suspendUser(id, true);

      if (!updatedUser) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
      }

      try {
        await deleteSession("user", id);
      } catch (sessionError) {
        console.error("관리자 회원삭제 세션 삭제 실패:", sessionError);
      }

      return res.json({
        success: true,
        message: "회원이 삭제되었습니다.",
      });
    } catch (error) {
      console.error("Delete user error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.patch("/api/admin/regular-users/:id/restore", adminAuthMiddleware, async (req, res) => {
    try {
      const { id } = req.params;

      const restoredUser = await adminUserStorage.restoreUser(id);

      if (!restoredUser) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
      }

      return res.json({
        success: true,
        message: "회원이 복구되었습니다.",
      });
    } catch (error) {
      console.error("Restore user error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  app.delete("/api/admin/regular-users/:id/hard-delete", adminAuthMiddleware, async (req, res) => {
    try {
      const { id } = req.params;

      const checkUser = await adminUserStorage.getUserById(id);
      if (!checkUser) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
      }
      if (checkUser.isSuspended !== 1) {
        return res.status(400).json({ error: "삭제된 회원만 완전 삭제할 수 있습니다." });
      }

      const deleted = await adminUserStorage.hardDeleteUser(id);

      if (!deleted) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
      }

      return res.json({
        success: true,
        message: "회원이 완전히 삭제되었습니다.",
      });
    } catch (error) {
      console.error("Hard delete user error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });
}
