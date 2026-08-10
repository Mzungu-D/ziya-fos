import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import prisma from "../config/prisma";

/* =========================================================
   SYSTEM HEALTH
   GET /api/platform/health
========================================================= */
export const getSystemHealth = async (_req: AuthRequest, res: Response) => {
  const startedAt = Date.now();

  try {
    /* ── DB ping + counts ── */
    const [
      dbPing,
      totalOrgs, activeOrgs,
      totalUsers, activeUsers,
      totalSubs, activeSubs,
      totalSessions,
      totalAuditLogs,
      todayAuditLogs,
    ] = await Promise.all([
      prisma.$queryRaw<[{ result: number }]>`SELECT 1 AS result`
        .then(() => true).catch(() => false),
      prisma.organization.count(),
      prisma.organization.count({ where: { status: "ACTIVE" } }),
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.subscription.count(),
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
      prisma.session.count(),
      prisma.platformAuditLog.count(),
      prisma.platformAuditLog.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    ]);

    const dbLatencyMs = Date.now() - startedAt;

    /* ── Server metrics ── */
    const mem     = process.memoryUsage();
    const uptimeSec = process.uptime();

    function fmtUptime(sec: number) {
      const d = Math.floor(sec / 86400);
      const h = Math.floor((sec % 86400) / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = Math.floor(sec % 60);
      if (d > 0) return `${d}d ${h}h ${m}m`;
      if (h > 0) return `${h}h ${m}m ${s}s`;
      return `${m}m ${s}s`;
    }

    return res.json({
      success: true,
      health: {
        status: dbPing ? "healthy" : "degraded",
        checkedAt: new Date().toISOString(),
        server: {
          uptime:     fmtUptime(uptimeSec),
          uptimeSec:  Math.floor(uptimeSec),
          nodeVersion: process.version,
          environment: process.env.NODE_ENV ?? "production",
          platform:   process.platform,
          memory: {
            usedMB:  Math.round(mem.heapUsed  / 1024 / 1024),
            totalMB: Math.round(mem.heapTotal / 1024 / 1024),
            rssMB:   Math.round(mem.rss       / 1024 / 1024),
            pct:     Math.round((mem.heapUsed / mem.heapTotal) * 100),
          },
        },
        database: {
          connected:  dbPing,
          provider:   "PostgreSQL",
          host:       "Railway (centerbeam proxy)",
          latencyMs:  dbLatencyMs,
          counts: {
            organizations: totalOrgs,
            activeOrgs,
            users:         totalUsers,
            activeUsers,
            subscriptions: totalSubs,
            activeSubs,
            sessions:      totalSessions,
            auditLogs:     totalAuditLogs,
            auditToday:    todayAuditLogs,
          },
        },
      },
    });
  } catch (error) {
    console.error("[PLATFORM] Health check failed:", error);
    return res.status(500).json({
      success: false,
      health: { status: "down" },
      message: "Health check failed.",
    });
  }
};