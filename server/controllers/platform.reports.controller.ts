import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import prisma from "../config/prisma";

/* =========================================================
   ANALYTICS SUMMARY
   GET /api/platform/reports/summary
========================================================= */
export const getAnalyticsSummary = async (_req: AuthRequest, res: Response) => {
  try {
    const [
      totalOrgs,
      activeOrgs,
      totalUsers,
      activeUsers,
      totalSubs,
      activeSubs,
      mrrData,
      recentAudit,
      topOrgs,
      countryData,
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.organization.count({ where: { status: "ACTIVE" } }),
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.subscription.count(),
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
      prisma.subscription.aggregate({
        where: { status: "ACTIVE", billingCycle: "MONTHLY" },
        _sum: { amount: true },
      }),
      prisma.platformAuditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true, action: true, resource: true,
          actorEmail: true, details: true, createdAt: true,
        },
      }),
      prisma.subscription.findMany({
        where: { status: "ACTIVE" },
        orderBy: { amount: "desc" },
        take: 5,
        include: {
          organization: { select: { id: true, name: true, country: true } },
        },
      }),
      prisma.organization.groupBy({
        by: ["country"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 6,
      }),
    ]);

    const mrr = mrrData._sum.amount ?? 0;

    return res.json({
      success: true,
      summary: {
        totalOrgs, activeOrgs,
        totalUsers, activeUsers,
        totalSubs, activeSubs,
        mrr,
      },
      recentAudit,
      topOrgs,
      countryBreakdown: countryData.map((c) => ({
        country: c.country,
        count:   c._count.id,
      })),
    });
  } catch (error) {
    console.error("[PLATFORM] Reports summary failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load analytics." });
  }
};

/* =========================================================
   GROWTH CHART (last 6 months: new orgs + new subs)
   GET /api/platform/reports/growth
========================================================= */
export const getGrowthData = async (_req: AuthRequest, res: Response) => {
  try {
    const months: { label: string; start: Date; end: Date }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      months.push({
        label: d.toLocaleString("en-KE", { month: "short", year: "2-digit" }),
        start,
        end,
      });
    }

    const growth = await Promise.all(
      months.map(async ({ label, start, end }) => {
        const [orgs, subs, users] = await Promise.all([
          prisma.organization.count({ where: { createdAt: { gte: start, lte: end } } }),
          prisma.subscription.count({ where: { createdAt: { gte: start, lte: end } } }),
          prisma.user.count({ where: { createdAt: { gte: start, lte: end } } }),
        ]);
        return { month: label, orgs, subs, users };
      })
    );

    // Subscription status breakdown
    const [active, trial, expired, suspended, cancelled] = await Promise.all([
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
      prisma.subscription.count({ where: { status: "TRIAL" } }),
      prisma.subscription.count({ where: { status: "EXPIRED" } }),
      prisma.subscription.count({ where: { status: "SUSPENDED" } }),
      prisma.subscription.count({ where: { status: "CANCELLED" } }),
    ]);

    // Plan breakdown
    const [starter, professional, enterprise] = await Promise.all([
      prisma.subscription.count({ where: { plan: "STARTER" } }),
      prisma.subscription.count({ where: { plan: "PROFESSIONAL" } }),
      prisma.subscription.count({ where: { plan: "ENTERPRISE" } }),
    ]);

    return res.json({
      success: true,
      growth,
      statusBreakdown: { active, trial, expired, suspended, cancelled },
      planBreakdown:   { starter, professional, enterprise },
    });
  } catch (error) {
    console.error("[PLATFORM] Growth data failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load growth data." });
  }
};