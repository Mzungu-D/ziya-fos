import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import prisma from "../config/prisma";

/* =========================================================
   GET LICENSING STATS
   GET /api/platform/licensing/stats
========================================================= */
export const getLicensingStats = async (_req: AuthRequest, res: Response) => {
  try {
    const [active, trial, expired, suspended, cancelled, total, expiringData] = await Promise.all([
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
      prisma.subscription.count({ where: { status: "TRIAL" } }),
      prisma.subscription.count({ where: { status: "EXPIRED" } }),
      prisma.subscription.count({ where: { status: "SUSPENDED" } }),
      prisma.subscription.count({ where: { status: "CANCELLED" } }),
      prisma.subscription.count(),
      prisma.subscription.findMany({
        where: {
          status: "ACTIVE",
          endDate: {
            gte: new Date(),
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        },
        select: { id: true },
      }),
    ]);

    const compliant  = active + trial;
    const compliance = total > 0 ? Math.round((compliant / total) * 100) : 100;

    return res.json({
      success: true,
      stats: {
        active, trial, expired, suspended, cancelled, total,
        expiringIn30Days: expiringData.length,
        complianceRate:   compliance,
      },
    });
  } catch (error) {
    console.error("[PLATFORM] Licensing stats failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load licensing stats." });
  }
};

/* =========================================================
   LIST LICENSES (paginated, filterable)
   GET /api/platform/licensing/licenses
========================================================= */
export const getLicenses = async (req: AuthRequest, res: Response) => {
  try {
    const q      = typeof req.query.q      === "string" ? req.query.q.trim()      : "";
    const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
    const plan   = typeof req.query.plan   === "string" ? req.query.plan.trim()   : "";
    const page   = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit  = Math.min(100, parseInt(req.query.limit as string) || 25);
    const skip   = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (plan)   where.plan   = plan;
    if (q) {
      where.organization = {
        OR: [
          { name:  { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      };
    }

    const [total, licenses] = await Promise.all([
      prisma.subscription.count({ where }),
      prisma.subscription.findMany({
        where,
        skip,
        take:    limit,
        orderBy: { createdAt: "desc" },
        include: {
          organization: {
            select: {
              id: true, name: true, slug: true, email: true,
              country: true, status: true, logoUrl: true,
            },
          },
        },
      }),
    ]);

    return res.json({
      success: true,
      licenses,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("[PLATFORM] Licenses list failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load licenses." });
  }
};