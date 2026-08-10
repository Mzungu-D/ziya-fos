import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware";
import prisma from "../config/prisma";

export const getSystemHealth = async (_req: AuthRequest, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    const [orgs, users, sessions] = await Promise.all([
      prisma.organization.count(),
      prisma.user.count(),
      prisma.session.count({ where: { isActive: true } }),
    ]);

    return res.json({
      success: true,
      health: {
        status:         "healthy",
        database:       "connected",
        activeSessions: sessions,
        totalOrgs:      orgs,
        totalUsers:     users,
        uptime:         process.uptime(),
        timestamp:      new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[PLATFORM] Health check failed:", error);
    return res.status(500).json({
      success: false,
      health:  { status: "unhealthy", database: "disconnected" },
    });
  }
};