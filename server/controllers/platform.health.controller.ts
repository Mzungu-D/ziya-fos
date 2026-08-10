import type { Request, Response } from "express";
import prisma from "../config/prisma";

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export async function getSystemHealth(_req: Request, res: Response): Promise<void> {
  try {
    /* ── DB latency ── */
    const dbStart = Date.now();
    let dbConnected = true;
    try { await prisma.$queryRaw`SELECT 1`; } catch { dbConnected = false; }
    const latencyMs = Date.now() - dbStart;

    /* ── Today boundary ── */
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    /* ── Parallel counts ── */
    const [
      organizations, activeOrgs,
      users, activeUsers,
      subscriptions, activeSubs,
      sessions,
      auditLogs, auditToday,
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.organization.count({ where: { status: "ACTIVE" }  as Record<string, unknown> }),
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } as Record<string, unknown> }),
      prisma.subscription.count(),
      prisma.subscription.count({ where: { status: "ACTIVE" } as Record<string, unknown> }),
      prisma.session.count({ where: { isActive: true } as Record<string, unknown> }),
      prisma.platformAuditLog.count(),
      prisma.platformAuditLog.count({
        where: { createdAt: { gte: todayStart } } as Record<string, unknown>,
      }),
    ]);

    /* ── Memory ── */
    const mem     = process.memoryUsage();
    const usedMB  = Math.round(mem.heapUsed  / 1024 / 1024);
    const totalMB = Math.round(mem.heapTotal  / 1024 / 1024);
    const rssMB   = Math.round(mem.rss        / 1024 / 1024);
    const pct     = totalMB > 0 ? Math.round((usedMB / totalMB) * 100) : 0;

    /* ── DB host ── */
    let dbHost = "railway";
    try { if (process.env.DATABASE_URL) dbHost = new URL(process.env.DATABASE_URL).hostname; } catch { /**/ }

    const status =
      !dbConnected    ? "down"     :
      latencyMs > 500 ? "degraded" :
                        "healthy";

    res.json({
      success: true,
      health: {
        status,
        checkedAt: new Date().toISOString(),
        server: {
          uptime:      formatUptime(process.uptime()),
          nodeVersion: process.version,
          platform:    process.platform,
          environment: process.env.NODE_ENV ?? "production",
          memory:      { pct, usedMB, totalMB, rssMB },
        },
        database: {
          connected: dbConnected,
          latencyMs,
          host:      dbHost,
          counts:    { organizations, activeOrgs, users, activeUsers, subscriptions, activeSubs, sessions, auditLogs, auditToday },
        },
      },
    });
  } catch {
    res.status(500).json({ success: false, message: "Health check failed" });
  }
}