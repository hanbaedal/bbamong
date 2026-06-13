import { randomUUID } from "crypto";
import { AdminUserModel } from "../UserStorage/db";
import type { InsertAdminUser, AdminUser, User } from "@shared/schema";
import { UserModel } from "../UserStorage/db";

export interface IAdminStorage {
  createAdminUser(data: InsertAdminUser): Promise<AdminUser>;
  getAdminUserById(id: string): Promise<AdminUser | undefined>;
  getAdminUserByEmail(email: string, approvedOnly?: boolean): Promise<AdminUser | undefined>;
  getAdminUserByUsername(username: string, approvedOnly?: boolean): Promise<AdminUser | undefined>;
  getAdminUserByPhone(phone: string, approvedOnly?: boolean): Promise<AdminUser | undefined>;
  getAllAdminUsers(): Promise<AdminUser[]>;
  updateAdminUser(id: string, data: Partial<AdminUser>): Promise<AdminUser | undefined>;
  deleteAdminUser(id: string): Promise<boolean>;
  updateApprovalStatus(id: string, status: "대기중" | "승인" | "거부"): Promise<AdminUser | undefined>;
  getAllRegularUsers(): Promise<User[]>;
  suspendUser(userId: string, isSuspended: boolean): Promise<User | undefined>;
  getTopDonors(page: number, limit: number): Promise<{ data: User[]; total: number }>;
  getAdminUsersByStatus(
    status: "대기중" | "승인" | "거부",
    page: number,
    limit: number,
  ): Promise<{ data: AdminUser[]; total: number; pendingCount: number; approvedCount: number }>;
  searchAdminUsersByStatus(
    status: "대기중" | "승인" | "거부",
    searchQuery: string,
    filterType: "전체" | "부서" | "직책",
    page: number,
    limit: number,
  ): Promise<{ data: AdminUser[]; total: number; pendingCount: number; approvedCount: number }>;
}

const EXCLUDED_TYPES = ["매니저", "슈퍼어드민"];

export class AdminStorage implements IAdminStorage {
  async createAdminUser(data: InsertAdminUser): Promise<AdminUser> {
    const cleanData = {
      ...data,
      id: randomUUID(),
      phone: data.phone ? data.phone.replace(/-/g, "") : data.phone,
    };
    const doc = await AdminUserModel.create(cleanData);
    return doc.toObject() as AdminUser;
  }

  async getAdminUserById(id: string): Promise<AdminUser | undefined> {
    const doc = await AdminUserModel.findOne({ id }).lean();
    return doc ? (doc as AdminUser) : undefined;
  }

  async getAdminUserByEmail(email: string, approvedOnly = false): Promise<AdminUser | undefined> {
    const filter: Record<string, unknown> = { email };
    if (approvedOnly) filter.approvalStatus = "승인";
    const doc = await AdminUserModel.findOne(filter).lean();
    return doc ? (doc as AdminUser) : undefined;
  }

  async getAdminUserByUsername(username: string, approvedOnly = false): Promise<AdminUser | undefined> {
    const filter: Record<string, unknown> = { username };
    if (approvedOnly) filter.approvalStatus = "승인";
    const doc = await AdminUserModel.findOne(filter).lean();
    return doc ? (doc as AdminUser) : undefined;
  }

  async getAdminUserByPhone(phone: string, approvedOnly = false): Promise<AdminUser | undefined> {
    const cleanPhone = phone.replace(/-/g, "");
    const filter: Record<string, unknown> = { phone: cleanPhone };
    if (approvedOnly) filter.approvalStatus = "승인";
    const doc = await AdminUserModel.findOne(filter).lean();
    return doc ? (doc as AdminUser) : undefined;
  }

  async getAllAdminUsers(): Promise<AdminUser[]> {
    const docs = await AdminUserModel.find().sort({ createdAt: -1 }).lean();
    return docs as AdminUser[];
  }

  async updateAdminUser(id: string, data: Partial<AdminUser>): Promise<AdminUser | undefined> {
    const cleanData = {
      ...data,
      ...(data.phone ? { phone: data.phone.replace(/-/g, "") } : {}),
    };
    const doc = await AdminUserModel.findOneAndUpdate({ id }, cleanData, { new: true }).lean();
    return doc ? (doc as AdminUser) : undefined;
  }

  async deleteAdminUser(id: string): Promise<boolean> {
    const result = await AdminUserModel.deleteOne({ id });
    return result.deletedCount > 0;
  }

  async updateApprovalStatus(
    id: string,
    status: "대기중" | "승인" | "거부",
  ): Promise<AdminUser | undefined> {
    const doc = await AdminUserModel.findOneAndUpdate(
      { id },
      { approvalStatus: status },
      { new: true },
    ).lean();
    return doc ? (doc as AdminUser) : undefined;
  }

  async getAllRegularUsers(): Promise<User[]> {
    const docs = await UserModel.find().sort({ createdAt: -1 }).lean();
    return docs as User[];
  }

  async suspendUser(userId: string, isSuspended: boolean): Promise<User | undefined> {
    const doc = await UserModel.findOneAndUpdate(
      { id: userId },
      { isSuspended: isSuspended ? 1 : 0 },
      { new: true },
    ).lean();
    return doc ? (doc as User) : undefined;
  }

  async getAdminUsersByStatus(status: "대기중" | "승인" | "거부", page = 1, limit = 8) {
    const offset = (page - 1) * limit;
    const baseFilter = { approvalStatus: status, userType: { $nin: EXCLUDED_TYPES } };

    const [total, pendingCount, approvedCount, data] = await Promise.all([
      AdminUserModel.countDocuments(baseFilter),
      AdminUserModel.countDocuments({ approvalStatus: "대기중", userType: { $nin: EXCLUDED_TYPES } }),
      AdminUserModel.countDocuments({ approvalStatus: "승인", userType: { $nin: EXCLUDED_TYPES } }),
      AdminUserModel.find(baseFilter).sort({ createdAt: -1 }).skip(offset).limit(limit).lean(),
    ]);

    return { data: data as AdminUser[], total, pendingCount, approvedCount };
  }

  async searchAdminUsersByStatus(
    status: "대기중" | "승인" | "거부",
    searchQuery: string,
    filterType: "전체" | "부서" | "직책",
    page = 1,
    limit = 8,
  ) {
    const offset = (page - 1) * limit;
    const regex = { $regex: searchQuery, $options: "i" };

    const searchFilter: Record<string, unknown> = {
      approvalStatus: status,
      userType: { $nin: EXCLUDED_TYPES },
    };

    if (filterType === "전체") {
      searchFilter.$or = [
        { department: regex },
        { position: regex },
        { name: regex },
        { email: regex },
      ];
    } else if (filterType === "부서") {
      searchFilter.department = regex;
    } else if (filterType === "직책") {
      searchFilter.position = regex;
    }

    const [total, pendingCount, approvedCount, data] = await Promise.all([
      AdminUserModel.countDocuments(searchFilter),
      AdminUserModel.countDocuments({ approvalStatus: "대기중", userType: { $nin: EXCLUDED_TYPES } }),
      AdminUserModel.countDocuments({ approvalStatus: "승인", userType: { $nin: EXCLUDED_TYPES } }),
      AdminUserModel.find(searchFilter).sort({ createdAt: -1 }).skip(offset).limit(limit).lean(),
    ]);

    return { data: data as AdminUser[], total, pendingCount, approvedCount };
  }

  async getTopDonors(page = 1, limit = 8): Promise<{ data: User[]; total: number }> {
    const offset = (page - 1) * limit;
    const [total, data] = await Promise.all([
      UserModel.countDocuments(),
      UserModel.find().sort({ totalDonationAmount: -1 }).skip(offset).limit(limit).lean(),
    ]);
    return { data: data as User[], total };
  }
}
