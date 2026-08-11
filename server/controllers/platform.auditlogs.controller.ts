import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware";
import prisma from "../config/prisma";

export const getAuditStats = async (_req: AuthRequest, res: Response) => {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [total, last30Days, byAction] = await Promise.all([
      prisma.platformAuditLog.count(),
      prisma.platformAuditLog.count({ where: { createdAt: { gte: since } } }),
      prisma.platformAuditLog.groupBy({
        by:      ["action"],
        _count:  { action: true },
        orderBy: { _count: { action: "desc" } },
        take:    10,
      }),
    ]);

    return res.json({
      success: true,
      stats: {
        total,
        last30Days,
        byAction: byAction.map((r) => ({ action: r.action, count: r._count.action })),
      },
    });
  } catch (error) {
    console.error("[PLATFORM] Audit stats failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load audit stats." });
  }
};

export const getAuditLogs = async (req: AuthRequest, res: Response) => {
  try {
    const q        = typeof req.query.q        === "string" ? req.query.q.trim()        : "";
    const action   = typeof req.query.action   === "string" ? req.query.action.trim()   : "";
    const resource = typeof req.query.resource === "string" ? req.query.resource.trim() : "";
    const page     = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit    = Math.min(100, parseInt(req.query.limit as string) || 50);
    const skip     = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (action)   where.action   = action;
    if (resource) where.resource = resource;
    if (q) {
      where.OR = [
        { actorEmail: { contains: q, mode: "insensitive" } },
        { details:    { contains: q, mode: "insensitive" } },
      ];
    }

    const [total, logs] = await Promise.all([
      prisma.platformAuditLog.count({ where }),
      prisma.platformAuditLog.findMany({
        where,
        skip,
        take:    limit,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return res.json({
      success:    true,
      logs,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("[PLATFORM] Audit logs fetch failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load audit logs." });
  }
};