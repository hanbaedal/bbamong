import type { Express, Response } from "express";
import { randomBytes, randomUUID } from "crypto";
import {
  FriendRoomAuditModel,
  FriendRoomMemberModel,
  FriendRoomModel,
  PredictionModel,
  UserModel,
} from "../UserStorage/db";
import { memberAuthMiddleware } from "../middleware/memberAuth";
import type { AuthenticatedUserRequest } from "../middleware/userAuth";
import { getKstDayRange } from "../utils/dateUtils";
import {
  FRIEND_ROOM_AUDIT_RETENTION_DAYS,
  FRIEND_ROOM_CAPACITY_DEFAULT,
  FRIEND_ROOM_CAPACITY_MAX,
  FRIEND_ROOM_CAPACITY_MIN,
  FRIEND_ROOM_MAX_MEMBERSHIPS,
} from "@shared/friendRooms";

function newInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

function clampCapacity(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n)) return FRIEND_ROOM_CAPACITY_DEFAULT;
  return Math.min(FRIEND_ROOM_CAPACITY_MAX, Math.max(FRIEND_ROOM_CAPACITY_MIN, Math.round(n)));
}

async function membershipCount(userId: string): Promise<number> {
  return FriendRoomMemberModel.countDocuments({ userId });
}

async function serializeRoom(roomId: string, viewerUserId: string) {
  const room = await FriendRoomModel.findOne({ id: roomId }).lean();
  if (!room) return null;
  const members = await FriendRoomMemberModel.find({ roomId }).lean();
  const userIds = members.map((m) => m.userId);
  const users = await UserModel.find({ id: { $in: userIds } })
    .select("id name username")
    .lean();
  const userMap = new Map(users.map((u) => [u.id, u]));
  const me = members.find((m) => m.userId === viewerUserId);
  return {
    id: room.id,
    name: room.name,
    description: room.description ?? "",
    supportTeam: room.supportTeam ?? "무관",
    ageGroup: room.ageGroup ?? "무관",
    region: room.region ?? "무관",
    capacity: room.capacity,
    hostUserId: room.hostUserId,
    inviteToken: room.inviteToken,
    invitePath: `/rooms/join/${room.inviteToken}`,
    memberCount: members.length,
    createdAt: room.createdAt,
    isHost: room.hostUserId === viewerUserId,
    myRole: me?.role ?? null,
    members: members.map((m) => ({
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt,
      name: userMap.get(m.userId)?.name ?? "회원",
      username: userMap.get(m.userId)?.username ?? "",
    })),
  };
}

export async function friendRoomRoutes(app: Express): Promise<void> {
  app.get("/api/rooms/mine", memberAuthMiddleware, async (req: AuthenticatedUserRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const memberships = await FriendRoomMemberModel.find({ userId }).sort({ joinedAt: -1 }).lean();
      const roomIds = memberships.map((m) => m.roomId);
      const rooms = await FriendRoomModel.find({ id: { $in: roomIds } }).lean();
      const roomMap = new Map(rooms.map((r) => [r.id, r]));
      const counts = await FriendRoomMemberModel.aggregate<{ _id: string; count: number }>([
        { $match: { roomId: { $in: roomIds } } },
        { $group: { _id: "$roomId", count: { $sum: 1 } } },
      ]);
      const countMap = new Map(counts.map((c) => [c._id, c.count]));
      const list = memberships
        .map((m) => {
          const room = roomMap.get(m.roomId);
          if (!room) return null;
          return {
            id: room.id,
            name: room.name,
            description: room.description ?? "",
            supportTeam: room.supportTeam ?? "무관",
            memberCount: countMap.get(room.id) ?? 0,
            capacity: room.capacity,
            isHost: room.hostUserId === userId,
            role: m.role,
            createdAt: room.createdAt,
          };
        })
        .filter(Boolean);
      return res.json({ rooms: list });
    } catch (error) {
      console.error("[FriendRoom] mine error:", error);
      return res.status(500).json({ error: "방 목록을 불러오지 못했습니다." });
    }
  });

  app.post("/api/rooms", memberAuthMiddleware, async (req: AuthenticatedUserRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const {
        name,
        description,
        supportTeam,
        ageGroup,
        region,
        capacity,
        disclaimerAccepted,
      } = req.body ?? {};

      if (disclaimerAccepted !== true) {
        return res.status(400).json({ error: "면책·이용 조건에 동의해야 방을 만들 수 있습니다." });
      }
      const trimmedName = String(name ?? "").trim();
      if (trimmedName.length < 2 || trimmedName.length > 40) {
        return res.status(400).json({ error: "방 이름은 2~40자로 입력해주세요." });
      }
      if ((await membershipCount(userId)) >= FRIEND_ROOM_MAX_MEMBERSHIPS) {
        return res.status(400).json({
          error: `동시에 참여할 수 있는 방은 최대 ${FRIEND_ROOM_MAX_MEMBERSHIPS}개입니다.`,
        });
      }

      const now = new Date();
      const roomId = randomUUID();
      const token = newInviteToken();
      const cap = clampCapacity(capacity);

      await FriendRoomModel.create({
        id: roomId,
        name: trimmedName,
        description: String(description ?? "").trim().slice(0, 200),
        supportTeam: String(supportTeam ?? "무관").trim().slice(0, 20) || "무관",
        ageGroup: String(ageGroup ?? "무관").trim().slice(0, 20) || "무관",
        region: String(region ?? "무관").trim().slice(0, 20) || "무관",
        capacity: cap,
        hostUserId: userId,
        inviteToken: token,
        disclaimerAgreedAt: now,
        createdAt: now,
      });
      await FriendRoomMemberModel.create({
        id: randomUUID(),
        roomId,
        userId,
        role: "host",
        joinedAt: now,
      });

      const room = await serializeRoom(roomId, userId);
      return res.status(201).json({ room });
    } catch (error) {
      console.error("[FriendRoom] create error:", error);
      return res.status(500).json({ error: "방 생성에 실패했습니다." });
    }
  });

  // join 경로를 :id 보다 먼저 등록 (Express 라우트 충돌 방지)
  app.get(
    "/api/rooms/join/:token/preview",
    memberAuthMiddleware,
    async (req: AuthenticatedUserRequest, res: Response) => {
      try {
        const room = await FriendRoomModel.findOne({ inviteToken: req.params.token }).lean();
        if (!room) return res.status(404).json({ error: "유효하지 않거나 종료된 초대입니다." });
        const memberCount = await FriendRoomMemberModel.countDocuments({ roomId: room.id });
        const already = await FriendRoomMemberModel.exists({
          roomId: room.id,
          userId: req.user!.userId,
        });
        return res.json({
          name: room.name,
          description: room.description ?? "",
          supportTeam: room.supportTeam ?? "무관",
          ageGroup: room.ageGroup ?? "무관",
          region: room.region ?? "무관",
          memberCount,
          capacity: room.capacity,
          alreadyMember: Boolean(already),
          roomId: room.id,
        });
      } catch (error) {
        console.error("[FriendRoom] preview error:", error);
        return res.status(500).json({ error: "초대 정보를 불러오지 못했습니다." });
      }
    },
  );

  app.post(
    "/api/rooms/join/:token",
    memberAuthMiddleware,
    async (req: AuthenticatedUserRequest, res: Response) => {
      try {
        const userId = req.user!.userId;
        const room = await FriendRoomModel.findOne({ inviteToken: req.params.token }).lean();
        if (!room) return res.status(404).json({ error: "유효하지 않거나 종료된 초대입니다." });

        const existing = await FriendRoomMemberModel.findOne({ roomId: room.id, userId }).lean();
        if (existing) {
          const serialized = await serializeRoom(room.id, userId);
          return res.json({ room: serialized, alreadyMember: true });
        }

        if ((await membershipCount(userId)) >= FRIEND_ROOM_MAX_MEMBERSHIPS) {
          return res.status(400).json({
            error: `동시에 참여할 수 있는 방은 최대 ${FRIEND_ROOM_MAX_MEMBERSHIPS}개입니다.`,
          });
        }
        const memberCount = await FriendRoomMemberModel.countDocuments({ roomId: room.id });
        if (memberCount >= room.capacity) {
          return res.status(400).json({ error: "방 정원이 가득 찼습니다." });
        }

        await FriendRoomMemberModel.create({
          id: randomUUID(),
          roomId: room.id,
          userId,
          role: "member",
          joinedAt: new Date(),
        });
        const serialized = await serializeRoom(room.id, userId);
        return res.json({ room: serialized, alreadyMember: false });
      } catch (error) {
        console.error("[FriendRoom] join error:", error);
        return res.status(500).json({ error: "방 입장에 실패했습니다." });
      }
    },
  );

  app.get("/api/rooms/:id", memberAuthMiddleware, async (req: AuthenticatedUserRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const roomId = req.params.id;
      const member = await FriendRoomMemberModel.findOne({ roomId, userId }).lean();
      if (!member) {
        return res.status(403).json({ error: "방에 속한 회원만 볼 수 있습니다." });
      }
      const room = await serializeRoom(roomId, userId);
      if (!room) return res.status(404).json({ error: "방을 찾을 수 없습니다." });
      return res.json({ room });
    } catch (error) {
      console.error("[FriendRoom] get error:", error);
      return res.status(500).json({ error: "방 정보를 불러오지 못했습니다." });
    }
  });

  app.post(
    "/api/rooms/:id/leave",
    memberAuthMiddleware,
    async (req: AuthenticatedUserRequest, res: Response) => {
      try {
        const userId = req.user!.userId;
        const roomId = req.params.id;
        const room = await FriendRoomModel.findOne({ id: roomId }).lean();
        if (!room) return res.status(404).json({ error: "방을 찾을 수 없습니다." });
        if (room.hostUserId === userId) {
          return res.status(400).json({ error: "방장은 나가기 대신 방을 종료해주세요." });
        }
        await FriendRoomMemberModel.deleteOne({ roomId, userId });
        return res.json({ ok: true });
      } catch (error) {
        console.error("[FriendRoom] leave error:", error);
        return res.status(500).json({ error: "나가기에 실패했습니다." });
      }
    },
  );

  app.post(
    "/api/rooms/:id/kick",
    memberAuthMiddleware,
    async (req: AuthenticatedUserRequest, res: Response) => {
      try {
        const userId = req.user!.userId;
        const roomId = req.params.id;
        const targetUserId = String(req.body?.userId ?? "");
        const room = await FriendRoomModel.findOne({ id: roomId }).lean();
        if (!room) return res.status(404).json({ error: "방을 찾을 수 없습니다." });
        if (room.hostUserId !== userId) {
          return res.status(403).json({ error: "방장만 멤버를 내보낼 수 있습니다." });
        }
        if (!targetUserId || targetUserId === userId) {
          return res.status(400).json({ error: "내보낼 회원을 확인해주세요." });
        }
        await FriendRoomMemberModel.deleteOne({ roomId, userId: targetUserId });
        return res.json({ ok: true });
      } catch (error) {
        console.error("[FriendRoom] kick error:", error);
        return res.status(500).json({ error: "멤버 내보내기에 실패했습니다." });
      }
    },
  );

  app.post(
    "/api/rooms/:id/close",
    memberAuthMiddleware,
    async (req: AuthenticatedUserRequest, res: Response) => {
      try {
        const userId = req.user!.userId;
        const roomId = req.params.id;
        const room = await FriendRoomModel.findOne({ id: roomId }).lean();
        if (!room) return res.status(404).json({ error: "방을 찾을 수 없습니다." });
        if (room.hostUserId !== userId) {
          return res.status(403).json({ error: "방장만 방을 종료할 수 있습니다." });
        }

        const memberCount = await FriendRoomMemberModel.countDocuments({ roomId });
        const closedAt = new Date();
        const expiresAt = new Date(
          closedAt.getTime() + FRIEND_ROOM_AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
        );
        await FriendRoomAuditModel.create({
          id: randomUUID(),
          hostUserId: room.hostUserId,
          roomNameSnapshot: room.name,
          disclaimerAgreedAt: room.disclaimerAgreedAt,
          createdAt: room.createdAt,
          closedAt,
          memberCountAtClose: memberCount,
          expiresAt,
        });
        await FriendRoomMemberModel.deleteMany({ roomId });
        await FriendRoomModel.deleteOne({ id: roomId });
        return res.json({ ok: true });
      } catch (error) {
        console.error("[FriendRoom] close error:", error);
        return res.status(500).json({ error: "방 종료에 실패했습니다." });
      }
    },
  );

  app.get(
    "/api/rooms/:id/ranking",
    memberAuthMiddleware,
    async (req: AuthenticatedUserRequest, res: Response) => {
      try {
        const userId = req.user!.userId;
        const roomId = req.params.id;
        const member = await FriendRoomMemberModel.findOne({ roomId, userId }).lean();
        if (!member) {
          return res.status(403).json({ error: "방에 속한 회원만 볼 수 있습니다." });
        }
        const members = await FriendRoomMemberModel.find({ roomId }).lean();
        const memberIds = members.map((m) => m.userId);
        const { start, end } = getKstDayRange();
        const preds = await PredictionModel.find({
          userId: { $in: memberIds },
          createdAt: { $gte: start, $lte: end },
          status: { $in: ["success", "fail"] },
        })
          .select("userId status wonAmount amount")
          .lean();

        const users = await UserModel.find({ id: { $in: memberIds } })
          .select("id name")
          .lean();
        const nameMap = new Map(users.map((u) => [u.id, u.name]));

        type Agg = { userId: string; name: string; hits: number; bets: number; net: number };
        const map = new Map<string, Agg>();
        for (const id of memberIds) {
          map.set(id, { userId: id, name: nameMap.get(id) ?? "회원", hits: 0, bets: 0, net: 0 });
        }
        for (const p of preds) {
          const row = map.get(p.userId);
          if (!row) continue;
          row.bets += 1;
          if (p.status === "success") {
            row.hits += 1;
            row.net += (p.wonAmount ?? 0) - (p.amount ?? 0);
          } else {
            row.net -= p.amount ?? 0;
          }
        }
        const ranking = [...map.values()].sort((a, b) => {
          if (b.hits !== a.hits) return b.hits - a.hits;
          if (b.net !== a.net) return b.net - a.net;
          return a.name.localeCompare(b.name, "ko");
        });
        return res.json({ ranking, dateLabel: "오늘(KST)" });
      } catch (error) {
        console.error("[FriendRoom] ranking error:", error);
        return res.status(500).json({ error: "순위를 불러오지 못했습니다." });
      }
    },
  );
}
