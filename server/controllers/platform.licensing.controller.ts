import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware";
import prisma from "../config/prisma";

export const getLicensingStats = async (_req: AuthRequest, res: Response) => {
  try {
    const [active, trial, expired, cancelled] = await Promise.all([
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
      prisma.subscription.count({ where: { status: "TRIAL" } }),
      prisma.subscription.count({ where: { status: "EXPIRED" } }),
      prisma.subscription.count({ where: { status: "CANCELLED" } }),
    ]);

    return res.json({
      success: true,
      stats: { active, trial, expired, cancelled, total: active + trial + expired + cancelled },
    });
  } catch (error) {
    console.error("[PLATFORM] Licensing stats failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load licensing stats." });
  }
};

export const getLicenses = async (req: AuthRequest, res: Response) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
    const page   = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit  = Math.min(100, parseInt(req.query.limit as string) || 30);
    const skip   = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [total, licenses] = await Promise.all([
      prisma.subscription.count({ where }),
      prisma.subscription.findMany({
        where,
        skip,
        take:    limit,
        orderBy: { createdAt: "desc" },
        include: {
          organization: { select: { id: true, name: true, slug: true, email: true, status: true } },
        },
      }),
    ]);

    return res.json({
      success:    true,
      licenses,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("[PLATFORM] Licenses fetch failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load licenses." });
  }
};