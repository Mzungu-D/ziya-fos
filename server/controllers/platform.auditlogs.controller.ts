import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import prisma from "../config/prisma";

/* =========================================================
   AUDIT LOG STATS
   GET /api/platform/audit-logs/stats
========================================================= */
export const getAuditStats = async (_req: AuthRequest, res: Response) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    const [total, today, thisWeek, actions] = await Promise.all([
      prisma.platformAuditLog.count(),
      prisma.platformAuditLog.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.platformAuditLog.count({ where: { createdAt: { gte: weekStart } } }),
      prisma.platformAuditLog.groupBy({
        by: ["action"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 6,
      }),
    ]);

    return res.json({
      success: true,
      stats: { total, today, thisWeek },
      topActions: actions.map((a) => ({ action: a.action, count: a._count.id })),
    });
  } catch (error) {
    console.error("[PLATFORM] Audit stats failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load audit stats." });
  }
};

/* =========================================================
   AUDIT LOGS LIST (paginated + searchable)
   GET /api/platform/audit-logs/list
========================================================= */
export const getAuditLogs = async (req: AuthRequest, res: Response) => {
  try {
    const q        = typeof req.query.q        === "string" ? req.query.q.trim()        : "";
    const action   = typeof req.query.action   === "string" ? req.query.action.trim()   : "";
    const resource = typeof req.query.resource === "string" ? req.query.resource.trim() : "";
    const page     = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit    = Math.min(100, parseInt(req.query.limit as string) || 30);
    const skip     = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (action)   where.action   = action;
    if (resource) where.resource = resource;
    if (q) {
      where.OR = [
        { actorEmail: { contains: q, mode: "insensitive" } },
        { action:     { contains: q, mode: "insensitive" } },
        { details:    { contains: q, mode: "insensitive" } },
        { resource:   { contains: q, mode: "insensitive" } },
      ];
    }

    const [total, logs] = await Promise.all([
      prisma.platformAuditLog.count({ where }),
      prisma.platformAuditLog.findMany({
        where,
        skip,
        take:    limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true, actorUserId: true, actorEmail: true,
          action: true, resource: true, resourceId: true,
          details: true, ipAddress: true, createdAt: true,
        },
      }),
    ]);

    return res.json({
      success: true,
      logs,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("[PLATFORM] Audit logs list failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load audit logs." });
  }
};