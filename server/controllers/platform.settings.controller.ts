import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import prisma from "../config/prisma";

/* =========================================================
   PLATFORM OVERVIEW (live DB stats for settings page)
   GET /api/platform/settings/overview
========================================================= */
export const getPlatformOverview = async (_req: AuthRequest, res: Response) => {
  try {
    const [
      totalOrgs, activeOrgs, pendingOrgs,
      totalUsers, activeUsers,
      totalSubs, activeSubs,
      totalAuditLogs,
      latestOrg,
      latestUser,
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.organization.count({ where: { status: "ACTIVE" } }),
      prisma.organization.count({ where: { status: "PENDING" } }),
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.subscription.count(),
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
      prisma.platformAuditLog.count(),
      prisma.organization.findFirst({ orderBy: { createdAt: "desc" }, select: { name: true, createdAt: true } }),
      prisma.user.findFirst({ orderBy: { createdAt: "desc" }, select: { name: true, createdAt: true } }),
    ]);

    return res.json({
      success: true,
      overview: {
        organizations: { total: totalOrgs, active: activeOrgs, pending: pendingOrgs },
        users:         { total: totalUsers, active: activeUsers },
        subscriptions: { total: totalSubs, active: activeSubs },
        auditLogs:     totalAuditLogs,
        latestOrg,
        latestUser,
        dbConnected:   true,
        environment:   process.env.NODE_ENV ?? "production",
        serverTime:    new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[PLATFORM] Settings overview failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load platform overview." });
  }
};