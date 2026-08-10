import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import prisma from "../config/prisma";

/* =========================================================
   GET ALL PLATFORM USERS
   GET /api/platform/users
========================================================= */

export const getPlatformUsers = async (req: AuthRequest, res: Response) => {
  try {
    const q      = typeof req.query.q      === "string" ? req.query.q.trim()      : "";
    const role   = typeof req.query.role   === "string" ? req.query.role.trim()   : "";
    const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
    const page   = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit  = Math.min(100, parseInt(req.query.limit as string) || 30);
    const skip   = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (q) {
      where.OR = [
        { name:  { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ];
    }

    if (role === "PLATFORM_ADMIN") where.platformRole = "PLATFORM_ADMIN";
    if (role === "tenant")         where.platformRole = null;
    if (status === "active")       where.isActive = true;
    if (status === "inactive")     where.isActive = false;

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id:            true,
          name:          true,
          email:         true,
          role:          true,
          platformRole:  true,
          isActive:      true,
          phoneNumber:   true,
          lastLoginAt:   true,
          createdAt:     true,
          loginAttempts: true,
          lockedUntil:   true,
          memberships: {
            select: {
              id:   true,
              role: true,
              organization: {
                select: { id: true, name: true, slug: true, status: true },
              },
            },
          },
        },
      }),
    ]);

    return res.json({
      success: true,
      users,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("[PLATFORM] Users fetch failed:", error);
    return res.status(500).json({ success: false, message: "Unable to retrieve users." });
  }
};

/* =========================================================
   GET SINGLE USER
   GET /api/platform/users/:userId
========================================================= */

export const getPlatformUser = async (req: AuthRequest, res: Response) => {
  try {
    const userId = typeof req.params.userId === "string" ? req.params.userId.trim() : "";
    if (!userId) return res.status(400).json({ success: false, message: "User ID is required." });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id:              true,
        name:            true,
        email:           true,
        role:            true,
        platformRole:    true,
        isActive:        true,
        phoneNumber:     true,
        lastLoginAt:     true,
        lastLoginIp:     true,
        createdAt:       true,
        updatedAt:       true,
        loginAttempts:   true,
        lockedUntil:     true,
        phoneVerifiedAt: true,
        emailVerifiedAt: true,
        memberships: {
          select: {
            id:       true,
            role:     true,
            isActive: true,
            joinedAt: true,
            organization: {
              select: { id: true, name: true, slug: true, status: true, country: true },
            },
          },
        },
      },
    });

    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    return res.json({ success: true, user });
  } catch (error) {
    console.error("[PLATFORM] User fetch failed:", error);
    return res.status(500).json({ success: false, message: "Unable to retrieve user." });
  }
};

/* =========================================================
   DEACTIVATE USER
   PATCH /api/platform/users/:userId/deactivate
========================================================= */

export const deactivateUser = async (req: AuthRequest, res: Response) => {
  try {
    const userId = typeof req.params.userId === "string" ? req.params.userId.trim() : "";
    if (!userId) return res.status(400).json({ success: false, message: "User ID is required." });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, isActive: true, platformRole: true },
    });

    if (!user)          return res.status(404).json({ success: false, message: "User not found." });
    if (!user.isActive) return res.status(409).json({ success: false, message: "User is already inactive." });

    if (user.platformRole === "PLATFORM_ADMIN" && req.user?.userId === userId) {
      return res.status(403).json({ success: false, message: "You cannot deactivate your own account." });
    }

    await prisma.user.update({ where: { id: userId }, data: { isActive: false } });

    await prisma.platformAuditLog.create({
      data: {
        actorUserId: req.user!.userId,
        actorEmail:  user.email,
        action:      "USER_DEACTIVATED",
        resource:    "USER",
        resourceId:  userId,
        details:     `Deactivated user ${user.email}`,
      },
    });

    return res.json({ success: true, message: "User deactivated." });
  } catch (error) {
    console.error("[PLATFORM] Deactivate user failed:", error);
    return res.status(500).json({ success: false, message: "Unable to deactivate user." });
  }
};

/* =========================================================
   ACTIVATE USER
   PATCH /api/platform/users/:userId/activate
========================================================= */

export const activateUser = async (req: AuthRequest, res: Response) => {
  try {
    const userId = typeof req.params.userId === "string" ? req.params.userId.trim() : "";
    if (!userId) return res.status(400).json({ success: false, message: "User ID is required." });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, isActive: true },
    });

    if (!user)         return res.status(404).json({ success: false, message: "User not found." });
    if (user.isActive) return res.status(409).json({ success: false, message: "User is already active." });

    await prisma.user.update({
      where: { id: userId },
      data:  { isActive: true, loginAttempts: 0, lockedUntil: null },
    });

    await prisma.platformAuditLog.create({
      data: {
        actorUserId: req.user!.userId,
        actorEmail:  user.email,
        action:      "USER_ACTIVATED",
        resource:    "USER",
        resourceId:  userId,
        details:     `Activated user ${user.email}`,
      },
    });

    return res.json({ success: true, message: "User activated." });
  } catch (error) {
    console.error("[PLATFORM] Activate user failed:", error);
    return res.status(500).json({ success: false, message: "Unable to activate user." });
  }
};

/* =========================================================
   UNLOCK USER
   PATCH /api/platform/users/:userId/unlock
========================================================= */

export const unlockUser = async (req: AuthRequest, res: Response) => {
  try {
    const userId = typeof req.params.userId === "string" ? req.params.userId.trim() : "";
    if (!userId) return res.status(400).json({ success: false, message: "User ID is required." });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, lockedUntil: true },
    });

    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    await prisma.user.update({
      where: { id: userId },
      data:  { loginAttempts: 0, lockedUntil: null },
    });

    await prisma.platformAuditLog.create({
      data: {
        actorUserId: req.user!.userId,
        actorEmail:  user.email,
        action:      "USER_UNLOCKED",
        resource:    "USER",
        resourceId:  userId,
        details:     `Unlocked account for ${user.email}`,
      },
    });

    return res.json({ success: true, message: "User account unlocked." });
  } catch (error) {
    console.error("[PLATFORM] Unlock user failed:", error);
    return res.status(500).json({ success: false, message: "Unable to unlock user." });
  }
};