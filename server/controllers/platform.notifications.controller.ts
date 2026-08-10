import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import prisma from "../config/prisma";

/* =========================================================
   GET NOTIFICATION SUMMARY
   GET /api/platform/notifications/summary
========================================================= */
export const getNotificationSummary = async (
  _req: AuthRequest,
  res: Response,
) => {
  try {
    const now     = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [openTickets, criticalTickets, expiringSoon, suspendedOrgs] =
      await Promise.all([
        prisma.supportTicket.count({ where: { status: "OPEN" } }),
        prisma.supportTicket.count({
          where: {
            priority: "CRITICAL",
            status:   { in: ["OPEN", "IN_PROGRESS"] },
          },
        }),
        prisma.subscription.count({
          where: {
            status:  { in: ["ACTIVE", "TRIAL"] },
            endDate: { lte: in7Days, gte: now },
          },
        }),
        prisma.organization.count({ where: { status: "SUSPENDED" } }),
      ]);

    type Severity = "high" | "medium" | "low";

    interface NotificationItem {
      type:     string;
      label:    string;
      link:     string;
      severity: Severity;
    }

    const items: NotificationItem[] = [];

    if (criticalTickets > 0) {
      items.push({
        type:     "critical",
        label:    `${criticalTickets} critical ticket${criticalTickets !== 1 ? "s" : ""} need immediate attention`,
        link:     "/platform/support",
        severity: "high",
      });
    }
    if (openTickets > 0) {
      items.push({
        type:     "tickets",
        label:    `${openTickets} open ticket${openTickets !== 1 ? "s" : ""} awaiting response`,
        link:     "/platform/support",
        severity: "medium",
      });
    }
    if (expiringSoon > 0) {
      items.push({
        type:     "expiring",
        label:    `${expiringSoon} subscription${expiringSoon !== 1 ? "s" : ""} expiring within 7 days`,
        link:     "/platform/subscriptions",
        severity: "medium",
      });
    }
    if (suspendedOrgs > 0) {
      items.push({
        type:     "suspended",
        label:    `${suspendedOrgs} suspended organisation${suspendedOrgs !== 1 ? "s" : ""}`,
        link:     "/platform/organizations",
        severity: "low",
      });
    }

    const total = openTickets + criticalTickets + expiringSoon + suspendedOrgs;

    return res.json({
      success: true,
      notifications: {
        total,
        openTickets,
        criticalTickets,
        expiringSoon,
        suspendedOrgs,
        items,
      },
    });
  } catch (error) {
    console.error("[PLATFORM] getNotificationSummary error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to load notifications." });
  }
};