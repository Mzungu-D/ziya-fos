import { Request, Response } from "express";
import { PrismaClient }     from "@prisma/client";

const prisma = new PrismaClient();

/* ── GET /reports/summary ──────────────────────────────── */
export async function getAnalyticsSummary(_req: Request, res: Response) {
  try {
    const now           = new Date();
    const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(now.getDate() - 30);
    const sixtyDaysAgo  = new Date(now); sixtyDaysAgo.setDate(now.getDate() - 60);

    const [
      totalOrgs, activeOrgs, pendingOrgs, suspendedOrgs,
      totalUsers, activeUsers,
      totalSubs, activeSubs,
      newOrgsThis, newOrgsPrev,
      newUsersThis, newUsersPrev,
      subsByPlan, subsByStatus,
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.organization.count({ where: { status: "ACTIVE"    } }),
      prisma.organization.count({ where: { status: "PENDING"   } }),
      prisma.organization.count({ where: { status: "SUSPENDED" } }),
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.subscription.count(),
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
      prisma.organization.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.organization.count({ where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
      prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.user.count({ where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
      prisma.subscription.groupBy({ by: ["plan"],   _count: { plan:   true }, orderBy: { _count: { plan:   "desc" } } }),
      prisma.subscription.groupBy({ by: ["status"], _count: { status: true }, orderBy: { _count: { status: "desc" } } }),
    ]);

    const pct = (curr: number, prev: number) =>
      prev > 0 ? `${((curr - prev) / prev * 100).toFixed(1)}%` : curr > 0 ? "+100%" : "0%";

    res.json({
      success: true,
      summary: {
        organizations: {
          total: totalOrgs, active: activeOrgs,
          pending: pendingOrgs, suspended: suspendedOrgs,
          newThisMonth: newOrgsThis,
          growthPct: pct(newOrgsThis, newOrgsPrev),
        },
        users: {
          total: totalUsers, active: activeUsers,
          newThisMonth: newUsersThis,
          growthPct: pct(newUsersThis, newUsersPrev),
        },
        subscriptions: {
          total: totalSubs, active: activeSubs,
          byPlan:   subsByPlan.map((s) => ({ plan:   s.plan,   count: s._count.plan   })),
          byStatus: subsByStatus.map((s) => ({ status: s.status, count: s._count.status })),
        },
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch analytics summary" });
  }
}

/* ── GET /reports/growth ───────────────────────────────── */
export async function getGrowthData(_req: Request, res: Response) {
  try {
    const months: { label: string; from: Date; to: Date }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d    = new Date();
      const from = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const to   = new Date(d.getFullYear(), d.getMonth() - i + 1, 0, 23, 59, 59);
      months.push({
        label: from.toLocaleString("en-US", { month: "short", year: "2-digit" }),
        from,
        to,
      });
    }

    const growth = await Promise.all(
      months.map(async (m) => {
        const [organizations, users, subscriptions] = await Promise.all([
          prisma.organization.count({ where: { createdAt: { gte: m.from, lte: m.to } } }),
          prisma.user.count({         where: { createdAt: { gte: m.from, lte: m.to } } }),
          prisma.subscription.count({ where: { createdAt: { gte: m.from, lte: m.to } } }),
        ]);
        return { month: m.label, organizations, users, subscriptions };
      })
    );

    res.json({ success: true, growth });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch growth data" });
  }
}