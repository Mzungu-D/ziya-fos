import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware";
import prisma from "../config/prisma";

export const getAnalyticsSummary = async (_req: AuthRequest, res: Response) => {
  try {
    const [totalOrgs, activeOrgs, totalUsers, activeSubscriptions, revenue] = await Promise.all([
      prisma.organization.count(),
      prisma.organization.count({ where: { status: "ACTIVE" } }),
      prisma.user.count({ where: { isActive: true } }),
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
      prisma.subscription.aggregate({
        where: { status: "ACTIVE" },
        _sum:  { amount: true },
      }),
    ]);

    return res.json({
      success: true,
      summary: {
        totalOrganizations:    totalOrgs,
        activeOrganizations:   activeOrgs,
        totalUsers,
        activeSubscriptions,
        monthlyRevenue:        revenue._sum.amount ?? 0,
      },
    });
  } catch (error) {
    console.error("[PLATFORM] Analytics summary failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load analytics summary." });
  }
};

export const getGrowthData = async (_req: AuthRequest, res: Response) => {
  try {
    /* Last 6 months of org registrations grouped by month */
    const since = new Date();
    since.setMonth(since.getMonth() - 6);

    const orgs = await prisma.organization.findMany({
      where:  { createdAt: { gte: since } },
      select: { createdAt: true, status: true },
      orderBy: { createdAt: "asc" },
    });

    /* Group by year-month */
    const grouped: Record<string, { month: string; registrations: number; active: number }> = {};
    for (const org of orgs) {
      const key = org.createdAt.toISOString().slice(0, 7); // "2025-01"
      if (!grouped[key]) grouped[key] = { month: key, registrations: 0, active: 0 };
      grouped[key].registrations++;
      if (org.status === "ACTIVE") grouped[key].active++;
    }

    return res.json({
      success:    true,
      growthData: Object.values(grouped),
    });
  } catch (error) {
    console.error("[PLATFORM] Growth data failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load growth data." });
  }
};