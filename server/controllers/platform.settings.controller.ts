import type { Request, Response } from "express";
import prisma from "../config/prisma";

export async function getPlatformOverview(_req: Request, res: Response): Promise<void> {
  try {
    /* ── DB check ── */
    let dbConnected = true;
    try { await prisma.$queryRaw`SELECT 1`; } catch { dbConnected = false; }

    /* ── Parallel queries ── */
    const [
      totalOrgs, activeOrgs, pendingOrgs,
      totalUsers, activeUsers,
      totalSubs, activeSubs,
      auditLogs,
      latestOrg,
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.organization.count({ where: { status: "ACTIVE" }  as Record<string, unknown> }),
      prisma.organization.count({ where: { status: "PENDING" } as Record<string, unknown> }),
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } as Record<string, unknown> }),
      prisma.subscription.count(),
      prisma.subscription.count({ where: { status: "ACTIVE" } as Record<string, unknown> }),
      prisma.platformAuditLog.count(),
      prisma.organization.findFirst({
        orderBy: { createdAt: "desc" },
        select:  { name: true, createdAt: true },
      }),
    ]);

    res.json({
      success: true,
      overview: {
        organizations: { total: totalOrgs,  active: activeOrgs,  pending: pendingOrgs },
        users:         { total: totalUsers,  active: activeUsers },
        subscriptions: { total: totalSubs,   active: activeSubs  },
        auditLogs,
        environment:   process.env.NODE_ENV ?? "production",
        dbConnected,
        serverTime:    new Date().toISOString(),
        latestOrg:     latestOrg
          ? { name: latestOrg.name, createdAt: latestOrg.createdAt.toISOString() }
          : undefined,
      },
    });
  } catch {
    res.status(500).json({ success: false, message: "Failed to load platform overview" });
  }
}