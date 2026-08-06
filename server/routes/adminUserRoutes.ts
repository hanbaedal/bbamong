import type { Express } from "express";
import { AdminUserStorage } from "../storage/adminUserStorage";
import { adminAuthMiddleware, superAdminAuthMiddleware } from "../middleware/adminAuth";
import { deleteSession } from "../sessionManager";
import { parseMemberPlatform } from "../utils/memberPlatform";
import { syncMemberDataSourceTags } from "../utils/memberDataSourceSync";
import { AdminInviteStorage } from "../storage/adminInviteStorage";

const adminUserStorage = new AdminUserStorage();
const adminInviteStorage = new AdminInviteStorage();

export async function adminUserRoutes(app: Express): Promise<void> {
  app.get("/api/admin/regular-users", adminAuthMiddleware, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 8;
      const offset = (page - 1) * limit;
      const platform = parseMemberPlatform(req.query.platform);

      const [regularUsers, total, suspendedTotal, counts] = await Promise.all([
        adminUserStorage.getRegularUsersPaginated(platform, limit, offset),
        adminUserStorage.getRegularUsersCount(platform),
        adminUserStorage.getRegularSuspendedUsersCount(platform),
        adminUserStorage.getMemberPlatformCounts(),
      ]);

      const usersWithoutPassword = regularUsers.map(
        ({ password, verificationCode, ...user }) => user,
      );

      return res.json({
        data: usersWithoutPassword,
        total,
        suspendedTotal,
        platform,
        counts,
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
      const platform = parseMemberPlatform(req.query.platform);

      const [regularUsers, total, suspendedTotal, counts] = await Promise.all([
        adminUserStorage.getSuspendedUsersPaginated(platform, limit, offset),
        adminUserStorage.getRegularUsersCount(platform),
        adminUserStorage.getRegularSuspendedUsersCount(platform),
        adminUserStorage.getMemberPlatformCounts(),
      ]);

      const usersWithoutPassword = regularUsers.map(
        ({ password, verificationCode, ...user }) => user,
      );

      return res.json({
        data: usersWithoutPassword,
        total,
        suspendedTotal,
        platform,
        counts,
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

  app.post("/api/admin/members/sync-data-source", superAdminAuthMiddleware, async (_req, res) => {
    try {
      const tags = await syncMemberDataSourceTags();
      return res.json({
        success: true,
        message: "회원 dataSource 태그를 재정렬했습니다.",
        ...tags,
      });
    } catch (error) {
      console.error("Member dataSource sync error:", error);
      return res.status(500).json({ error: "회원 dataSource 재정렬에 실패했습니다." });
    }
  });

  app.get("/api/admin/invite-rankings", adminAuthMiddleware, async (req, res) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 8;
      const platform = parseMemberPlatform(req.query.platform);

      const [rankings, counts] = await Promise.all([
        adminInviteStorage.getInviteRankings(platform, page, limit),
        adminUserStorage.getMemberPlatformCounts(),
      ]);

      return res.json({ ...rankings, platform, counts });
    } catch (error) {
      console.error("Get invite rankings error:", error);
      return res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });
}
