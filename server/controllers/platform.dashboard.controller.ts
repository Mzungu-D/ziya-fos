import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware";
import prisma from "../config/prisma";

export const getDashboardStats = async (_req: AuthRequest, res: Response) => {
  try {
    const [
      totalOrgs,
      pendingOrgs,
      activeOrgs,
      suspendedOrgs,
      totalUsers,
      activeSubscriptions,
      trialSubscriptions,
      revenueAgg,
      rawPlanBreakdown,
      pendingApprovals,
      recentOrgs,
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.organization.count({ where: { status: "PENDING" } }),
      prisma.organization.count({ where: { status: "ACTIVE" } }),
      prisma.organization.count({ where: { status: "SUSPENDED" } }),
      prisma.user.count({ where: { isActive: true } }),
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
      prisma.subscription.count({ where: { status: "TRIAL" } }),
      prisma.subscription.aggregate({
        where: { status: "ACTIVE" },
        _sum:  { amount: true },
      }),
      prisma.subscription.groupBy({
        by:      ["plan"],
        _count:  { plan: true },
        orderBy: { _count: { plan: "desc" } },
      }),
      prisma.organization.findMany({
        where:   { status: "PENDING" },
        orderBy: { createdAt: "desc" },
        take:    10,
        select:  {
          id: true, name: true, email: true,
          country: true, createdAt: true,
        },
      }),
      prisma.organization.findMany({
        orderBy: { createdAt: "desc" },
        take:    8,
        include: {
          subscription: { select: { plan: true, status: true } },
          memberships:  { where: { isActive: true }, select: { id: true } },
        },
      }),
    ]);

    const recentOrganizations = recentOrgs.map((org) => ({
      id:       org.id,
      name:     org.name,
      location: org.country,
      plan:     org.subscription?.plan    ?? "—",
      users:    org.memberships.length,
      status:   org.subscription?.status ?? org.status,
    }));

    const subscriptionsByPlan = rawPlanBreakdown.map((r) => ({
      plan:  r.plan,
      count: r._count.plan,
    }));

    return res.json({
      success: true,
      stats: {
        organizations: {
          total:     totalOrgs,
          pending:   pendingOrgs,
          active:    activeOrgs,
          suspended: suspendedOrgs,
          change:    "+0%",
        },
        users: {
          total:  totalUsers,
          change: "+0%",
        },
        subscriptions: {
          total:  activeSubscriptions + trialSubscriptions,
          active: activeSubscriptions,
          trial:  trialSubscriptions,
          change: "+0%",
        },
        revenue: {
          total:  revenueAgg._sum.amount ?? 0,
          change: "+0%",
        },
      },
      subscriptionsByPlan,
      recentOrganizations,
      pendingApprovals,
    });
  } catch (error) {
    console.error("[PLATFORM] Dashboard stats failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load dashboard stats." });
  }
};