import { Response } from "express";
import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

/**
 * =========================================================
 * USER CONTROLLER
 * =========================================================
 *
 * Tenant isolation:
 * - Organization comes only from authenticated JWT context.
 * - Users are returned only when they belong to the
 *   authenticated organization.
 * - Membership role and permissions are organization-specific.
 * =========================================================
 */

export const getUsers = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId =
      req.user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        code: "AUTH_REQUIRED",
        message: "Authentication required.",
      });
    }

    const memberships =
      await prisma.organizationMember.findMany({
        where: {
          organizationId,
        },

        select: {
          id: true,
          role: true,
          permissions: true,
          isActive: true,
          isDefault: true,
          joinedAt: true,

          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phoneNumber: true,
              isActive: true,
              createdAt: true,
            },
          },
        },

        orderBy: {
          joinedAt: "asc",
        },
      });

    const users = memberships.map(
      (membership) => ({
        id: membership.user.id,
        name: membership.user.name,
        email: membership.user.email,
        phoneNumber:
          membership.user.phoneNumber,

        /*
         * Organization-specific access information.
         */
        role: membership.role,
        permissions:
          membership.permissions ?? [],
        membershipId: membership.id,
        membershipActive:
          membership.isActive,
        isDefault:
          membership.isDefault,
        joinedAt:
          membership.joinedAt,

        /*
         * Global user account status.
         */
        isActive:
          membership.user.isActive,
        createdAt:
          membership.user.createdAt,
      })
    );

    return res.status(200).json({
      success: true,
      organizationId,
      users,
    });
  } catch (error) {
    console.error(
      "[USERS] Failed to fetch organization users:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "USER_FETCH_FAILED",
      message:
        "Failed to fetch organization users.",
    });
  }
};