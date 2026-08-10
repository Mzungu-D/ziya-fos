import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import prisma from "../config/prisma";

/* =========================================================
   GET DASHBOARD STATS
   GET /api/platform/dashboard/stats
========================================================= */
export const getDashboardStats = async (
  _req: AuthRequest,
  res: Response,
) => {
  try {
    const now          = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth    = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const [
      totalOrgs,
      orgsLastMonth,
      totalUsers,
      usersLastMonth,
      totalSubscriptions,
      subsLastMonth,
      revenueThisMonth,
      revenueLastMonth,
      recentOrgs,
      subsByPlan,
    ] = await Promise.all([
      /* orgs */
      prisma.organization.count(),
      prisma.organization.count({
        where: { createdAt: { lt: startOfMonth } },
      }),

      /* users */
      prisma.user.count(),
      prisma.user.count({
        where: { createdAt: { lt: startOfMonth } },
      }),

      /* subscriptions */
      prisma.subscription.count({ where: { status: { in: ["ACTIVE", "TRIAL"] } } }),
      prisma.subscription.count({
        where: {
          status:    { in: ["ACTIVE", "TRIAL"] },
          createdAt: { lt: startOfMonth },
        },
      }),

      /* revenue this month */
      prisma.subscription.aggregate({
        where: {
          status:    "ACTIVE",
          createdAt: { gte: startOfMonth },
        },
        _sum: { amount: true },
      }),

      /* revenue last month */
      prisma.subscription.aggregate({
        where: {
          status:    "ACTIVE",
          createdAt: { gte: lastMonth, lte: endLastMonth },
        },
        _sum: { amount: true },
      }),

      /* recent organizations */
      prisma.organization.findMany({
        orderBy: { createdAt: "desc" },
        take:    8,
        select: {
          id:        true,
          name:      true,
          country:   true,
          status:    true,
          createdAt: true,
          subscription: {
            select: { plan: true, status: true },
          },
          memberships: {
            select: { id: true },
          },
        },
      }),

      /* subscriptions by plan */
      prisma.subscription.groupBy({
        by:    ["plan"],
        where: { status: { in: ["ACTIVE", "TRIAL"] } },
        _count: true,
      }),
    ]);

    function pctChange(current: number, previous: number): string {
      if (previous === 0) return current > 0 ? "+100%" : "0%";
      const change = ((current - previous) / previous) * 100;
      return `${change >= 0 ? "+" : ""}${Math.round(change)}%`;
    }

    const thisMonthRev = revenueThisMonth._sum.amount ?? 0;
    const lastMonthRev = revenueLastMonth._sum.amount ?? 0;

    return res.json({
      success: true,
      stats: {
        organizations: {
          total:  totalOrgs,
          change: pctChange(totalOrgs, orgsLastMonth),
        },
        users: {
          total:  totalUsers,
          change: pctChange(totalUsers, usersLastMonth),
        },
        subscriptions: {
          total:  totalSubscriptions,
          change: pctChange(totalSubscriptions, subsLastMonth),
        },
        revenue: {
          total:  thisMonthRev,
          change: pctChange(thisMonthRev, lastMonthRev),
        },
      },
      recentOrganizations: recentOrgs.map((o) => ({
        id:       o.id,
        name:     o.name,
        location: o.country,
        plan:     o.subscription?.plan ?? "—",
        users:    o.memberships.length,
        status:   o.status,
      })),
      subscriptionsByPlan: subsByPlan.map((s) => ({
        plan:  s.plan,
        count: s._count,
      })),
    });
  } catch (error) {
    console.error("[PLATFORM] getDashboardStats error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to load dashboard stats." });
  }
};