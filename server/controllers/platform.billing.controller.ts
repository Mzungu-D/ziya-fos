import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import prisma from "../config/prisma";

export const getBillingStats = async (_req: AuthRequest, res: Response) => {
  try {
    const [
      activeCount, trialCount, suspendedCount, expiredCount, cancelledCount,
      mrrData, arrData,
      starterCount, professionalCount, enterpriseCount,
      expiringData, recentSubs,
    ] = await Promise.all([
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
      prisma.subscription.count({ where: { status: "TRIAL" } }),
      prisma.subscription.count({ where: { status: "SUSPENDED" } }),
      prisma.subscription.count({ where: { status: "EXPIRED" } }),
      prisma.subscription.count({ where: { status: "CANCELLED" } }),
      prisma.subscription.aggregate({ where: { status: "ACTIVE", billingCycle: "MONTHLY" }, _sum: { amount: true } }),
      prisma.subscription.aggregate({ where: { status: "ACTIVE", billingCycle: "ANNUAL" },  _sum: { amount: true } }),
      prisma.subscription.count({ where: { plan: "STARTER" } }),
      prisma.subscription.count({ where: { plan: "PROFESSIONAL" } }),
      prisma.subscription.count({ where: { plan: "ENTERPRISE" } }),
      prisma.subscription.findMany({
        where: {
          status: "ACTIVE",
          endDate: { gte: new Date(), lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
        },
        include: { organization: { select: { id: true, name: true, country: true } } },
        orderBy: { endDate: "asc" },
        take: 5,
      }),
      prisma.subscription.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { organization: { select: { id: true, name: true, country: true } } },
      }),
    ]);

    const mrr = mrrData._sum.amount ?? 0;
    const arr = (arrData._sum.amount ?? 0) + mrr * 12;

    return res.json({
      success: true,
      stats: {
        mrr, arr,
        counts: { active: activeCount, trial: trialCount, suspended: suspendedCount, expired: expiredCount, cancelled: cancelledCount, total: activeCount + trialCount + suspendedCount + expiredCount + cancelledCount },
        planBreakdown: { starter: starterCount, professional: professionalCount, enterprise: enterpriseCount },
      },
      expiringSoon: expiringData,
      recentSubscriptions: recentSubs,
    });
  } catch (error) {
    console.error("[PLATFORM] Billing stats failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load billing stats." });
  }
};

export const getRevenueBreakdown = async (_req: AuthRequest, res: Response) => {
  try {
    const subs = await prisma.subscription.findMany({
      where: { status: { in: ["ACTIVE", "TRIAL"] } },
      select: { amount: true, billingCycle: true, plan: true, createdAt: true },
    });

    const months: { label: string; year: number; month: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push({ label: d.toLocaleString("en-KE", { month: "short", year: "2-digit" }), year: d.getFullYear(), month: d.getMonth() });
    }

    const revenue = months.map(({ label, year, month }) => {
      const end = new Date(year, month + 1, 0, 23, 59, 59);
      const total = subs
        .filter((s) => new Date(s.createdAt) <= end)
        .reduce((sum, s) => sum + (s.billingCycle === "ANNUAL" ? s.amount / 12 : s.amount), 0);
      return { month: label, revenue: Math.round(total) };
    });

    const planRevenue = {
      STARTER:      subs.filter((s) => s.plan === "STARTER").reduce((a, s) => a + (s.billingCycle === "ANNUAL" ? s.amount / 12 : s.amount), 0),
      PROFESSIONAL: subs.filter((s) => s.plan === "PROFESSIONAL").reduce((a, s) => a + (s.billingCycle === "ANNUAL" ? s.amount / 12 : s.amount), 0),
      ENTERPRISE:   subs.filter((s) => s.plan === "ENTERPRISE").reduce((a, s) => a + (s.billingCycle === "ANNUAL" ? s.amount / 12 : s.amount), 0),
    };

    return res.json({ success: true, revenue, planRevenue });
  } catch (error) {
    console.error("[PLATFORM] Revenue breakdown failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load revenue breakdown." });
  }
};