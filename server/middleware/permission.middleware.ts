import { Response, NextFunction } from "express";
import prisma from "../config/prisma";
import { AuthRequest } from "./auth.middleware";

/**
 * =========================================================
 * TENANT PERMISSION MIDDLEWARE
 * =========================================================
 *
 * Permanent RBAC rules:
 *
 * 1. User must be authenticated.
 * 2. User must belong to the authenticated organization.
 * 3. Membership must be active.
 * 4. User account must be active.
 * 5. Organization must be active.
 * 6. OWNER has full access inside their organization.
 * 7. "*" grants full access inside the organization.
 * 8. Other members use explicit permissions.
 *
 * No permission ever grants access to another organization.
 * =========================================================
 */

export const requirePermission =
  (...requiredPermissions: string[]) =>
  async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          code: "AUTH_REQUIRED",
          message: "Authentication required.",
        });
      }

      const { userId, organizationId } = req.user;

      if (!userId || !organizationId) {
        return res.status(401).json({
          success: false,
          code: "INVALID_SESSION",
          message: "Invalid authenticated session.",
        });
      }

      const membership =
        await prisma.organizationMember.findUnique({
          where: {
            userId_organizationId: {
              userId,
              organizationId,
            },
          },

          select: {
            id: true,
            role: true,
            permissions: true,
            isActive: true,

            organization: {
              select: {
                id: true,
                status: true,
              },
            },

            user: {
              select: {
                id: true,
                isActive: true,
              },
            },
          },
        });

      if (!membership) {
        return res.status(403).json({
          success: false,
          code: "MEMBERSHIP_REQUIRED",
          message:
            "You do not belong to this organization.",
        });
      }

      if (!membership.isActive) {
        return res.status(403).json({
          success: false,
          code: "MEMBERSHIP_INACTIVE",
          message:
            "Your organization membership is inactive.",
        });
      }

      if (!membership.user.isActive) {
        return res.status(403).json({
          success: false,
          code: "USER_INACTIVE",
          message:
            "This user account is inactive.",
        });
      }

      if (
        membership.organization.status !== "ACTIVE"
      ) {
        return res.status(403).json({
          success: false,
          code: "ORGANIZATION_INACTIVE",
          message:
            "This organization is not active.",
        });
      }

      /**
       * OWNER
       *
       * The owner controls their organization.
       * Full access applies ONLY to this organization
       * because the membership was resolved using:
       *
       * userId + organizationId
       */
      if (membership.role === "OWNER") {
        return next();
      }

      const permissions: string[] =
        membership.permissions ?? [];

      /**
       * Explicit wildcard.
       *
       * Useful for custom administrative roles.
       */
      if (permissions.includes("*")) {
        return next();
      }

      const hasAllRequiredPermissions =
        requiredPermissions.every(
          (permission: string) =>
            permissions.includes(permission)
        );

      if (!hasAllRequiredPermissions) {
        return res.status(403).json({
          success: false,
          code: "PERMISSION_DENIED",
          message:
            "You do not have permission to perform this action.",
          requiredPermissions,
        });
      }

      return next();
    } catch (error) {
      console.error(
        "[PERMISSION] Authorization failed:",
        error
      );

      return res.status(500).json({
        success: false,
        code: "PERMISSION_CHECK_FAILED",
        message:
          "Authorization could not be completed.",
      });
    }
  };