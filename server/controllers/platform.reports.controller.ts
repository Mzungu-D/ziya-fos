import { Request, Response } from "express";
import { PrismaClient }     from "@prisma/client";

const prisma = new PrismaClient();

/* ── GET /reports/summary ──────────────────────────────────
   Returns: summary (KPIs), recentAudit, topOrgs, countryBreakdown
─────────────────────────────────────────────────────────── */
export async function getAnalyticsSummary(_req: Request, res: Response) {
  try {
    const [
      totalOrgs,
      activeOrgs,
      totalUsers,
      activeUsers,
      totalSubs,
      activeSubs,
      mrrAgg,
      recentAudit,
      topOrgsSubs,
      countryRaw,
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.organization.count({ where: { status: "ACTIVE" } }),
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.subscription.count(),
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
      prisma.subscription.aggregate({
        where: { status: "ACTIVE" },
        _sum:  { amount: true },
      }),
      prisma.platformAuditLog.findMany({
        orderBy: { createdAt: "desc" },
        take:    10,
      }),
      prisma.subscription.findMany({
        orderBy: { amount: "desc" },
        take:    5,
        include: { organization: { select: { name: true, country: true } } },
      }),
      prisma.organization.groupBy({
        by:      ["country"],
        _count:  { country: true },
        orderBy: { _count: { country: "desc" } },
        take:    8,
      }),
    ]);

    const mrr = mrrAgg._sum.amount ?? 0;

    const topOrgs = topOrgsSubs.map((s) => ({
      id:           s.id,
      plan:         s.plan,
      amount:       s.amount,
      organization: s.organization,
    }));

    const countryBreakdown = countryRaw.map((r) => ({
      country: r.country,
      count:   r._count.country,
    }));

    res.json({
      success: true,
      summary: { totalOrgs, activeOrgs, totalUsers, activeUsers, totalSubs, activeSubs, mrr },
      recentAudit,
      topOrgs,
      countryBreakdown,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch analytics summary" });
  }
}

/* ── GET /reports/growth ───────────────────────────────────
   Returns: growth (6-month series), statusBreakdown, planBreakdown
─────────────────────────────────────────────────────────── */
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
        const [orgs, users] = await Promise.all([
          prisma.organization.count({ where: { createdAt: { gte: m.from, lte: m.to } } }),
          prisma.user.count({         where: { createdAt: { gte: m.from, lte: m.to } } }),
        ]);
        return { month: m.label, orgs, users };
      })
    );

    const [statusRaw, planRaw] = await Promise.all([
      prisma.subscription.groupBy({ by: ["status"], _count: { status: true } }),
      prisma.subscription.groupBy({ by: ["plan"],   _count: { plan:   true } }),
    ]);

    const byStatus = (s: string) =>
      statusRaw.find((r) => r.status.toUpperCase() === s)?._count.status ?? 0;
    const byPlan = (p: string) =>
      planRaw.find((r) => r.plan.toUpperCase() === p)?._count.plan ?? 0;

    res.json({
      success: true,
      growth,
      statusBreakdown: {
        active:    byStatus("ACTIVE"),
        trial:     byStatus("TRIAL"),
        expired:   byStatus("EXPIRED"),
        suspended: byStatus("SUSPENDED"),
        cancelled: byStatus("CANCELLED"),
      },
      planBreakdown: {
        starter:      byPlan("STARTER"),
        professional: byPlan("PROFESSIONAL"),
        enterprise:   byPlan("ENTERPRISE"),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch growth data" });
  }
}