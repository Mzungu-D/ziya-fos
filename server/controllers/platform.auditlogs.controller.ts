import { Request, Response } from "express";
import { PrismaClient }     from "@prisma/client";

const prisma = new PrismaClient();

/* ── GET /audit-logs/stats ─────────────────────────────── */
export async function getAuditStats(_req: Request, res: Response) {
  try {
    const now          = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek  = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);

    const [total, today, thisWeek, topActionsRaw] = await Promise.all([
      prisma.platformAuditLog.count(),
      prisma.platformAuditLog.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.platformAuditLog.count({ where: { createdAt: { gte: startOfWeek  } } }),
      prisma.platformAuditLog.groupBy({
        by:      ["action"],
        _count:  { action: true },
        orderBy: { _count: { action: "desc" } },
        take:    5,
      }),
    ]);

    const topActions = topActionsRaw.map((r) => ({
      action: r.action,
      count:  r._count.action,
    }));

    res.json({ success: true, stats: { total, today, thisWeek }, topActions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch audit stats" });
  }
}

/* ── GET /audit-logs/list ──────────────────────────────── */
export async function getAuditLogs(req: Request, res: Response) {
  try {
    const q        = (req.query.q        as string) ?? "";
    const resource = (req.query.resource as string) ?? "";
    const page     = Math.max(1,   parseInt((req.query.page  as string) ?? "1",  10));
    const limit    = Math.min(100, parseInt((req.query.limit as string) ?? "30", 10));
    const skip     = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (resource) where.resource = resource;
    if (q) {
      where.OR = [
        { actorEmail: { contains: q, mode: "insensitive" } },
        { action:     { contains: q, mode: "insensitive" } },
        { details:    { contains: q, mode: "insensitive" } },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.platformAuditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.platformAuditLog.count({ where }),
    ]);

    res.json({
      success: true,
      logs,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch audit logs" });
  }
}