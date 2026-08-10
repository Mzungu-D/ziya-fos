import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware";
import prisma from "../config/prisma";

export const getPlatformOverview = async (_req: AuthRequest, res: Response) => {
  try {
    const [totalOrgs, totalUsers, totalSubscriptions] = await Promise.all([
      prisma.organization.count(),
      prisma.user.count(),
      prisma.subscription.count(),
    ]);

    return res.json({
      success: true,
      overview: {
        platform:           "Ziya FOS",
        version:            "1.0.0",
        totalOrgs,
        totalUsers,
        totalSubscriptions,
      },
    });
  } catch (error) {
    console.error("[PLATFORM] Settings overview failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load settings overview." });
  }
};