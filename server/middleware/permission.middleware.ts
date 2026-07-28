import {
  Response,
  NextFunction,
} from "express";

import prisma from "../config/prisma";
import { AuthRequest } from "./auth.middleware";

/* =========================================================
   TENANT PERMISSION MIDDLEWARE

   SECURITY BOUNDARY

   PLATFORM SESSION
   - Cannot use tenant permissions
   - Cannot access tenant financial operations
   - PLATFORM_ADMIN does NOT bypass tenant isolation

   TENANT SESSION
   - Must belong to the organization
   - Membership must be active
   - User must be active
   - Organization must be active
   - OWNER has full access within that tenant only
   - "*" grants full access within that tenant only
   - Other users require explicit permissions

   Platform administration and tenant financial access
   are intentionally separate.
========================================================= */

export const requirePermission =
  (...requiredPermissions: string[]) =>
  async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      /* =====================================================
         AUTHENTICATION REQUIRED
      ===================================================== */

      if (!req.user) {
        return res.status(401).json({
          success: false,
          code: "AUTH_REQUIRED",
          message:
            "Authentication required.",
        });
      }

      /* =====================================================
         TENANT SESSION REQUIRED

         This is the permanent boundary preventing
         PLATFORM_ADMIN from entering tenant financial
         routes using platform privileges.
      ===================================================== */

      if (
        req.user.sessionType !== "TENANT"
      ) {
        return res.status(403).json({
          success: false,
          code: "TENANT_SESSION_REQUIRED",
          message:
            "A tenant session is required to access this resource.",
        });
      }

      const {
        userId,
        organizationId,
      } = req.user;

      if (
        !userId ||
        !organizationId
      ) {
        return res.status(401).json({
          success: false,
          code: "INVALID_TENANT_SESSION",
          message:
            "Invalid tenant session.",
        });
      }

      /* =====================================================
         CURRENT MEMBERSHIP IS SOURCE OF TRUTH

         Never authorize from JWT role alone.
      ===================================================== */

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

      /* =====================================================
         MEMBERSHIP REQUIRED
      ===================================================== */

      if (!membership) {
        return res.status(403).json({
          success: false,
          code: "MEMBERSHIP_REQUIRED",
          message:
            "You do not belong to this organization.",
        });
      }

      /* =====================================================
         MEMBERSHIP MUST BE ACTIVE
      ===================================================== */

      if (!membership.isActive) {
        return res.status(403).json({
          success: false,
          code: "MEMBERSHIP_INACTIVE",
          message:
            "Your organization membership is inactive.",
        });
      }

      /* =====================================================
         USER MUST BE ACTIVE
      ===================================================== */

      if (!membership.user.isActive) {
        return res.status(403).json({
          success: false,
          code: "USER_INACTIVE",
          message:
            "This user account is inactive.",
        });
      }

      /* =====================================================
         ORGANIZATION MUST BE ACTIVE
      ===================================================== */

      if (
        membership.organization.status !==
        "ACTIVE"
      ) {
        return res.status(403).json({
          success: false,
          code: "ORGANIZATION_INACTIVE",
          message:
            "This organization is not active.",
        });
      }

      /* =====================================================
         OWNER

         OWNER has full access only inside the
         organization represented by this membership.

         OWNER does NOT receive platform privileges.
      ===================================================== */

      if (
        membership.role === "OWNER"
      ) {
        return next();
      }

      const permissions =
        membership.permissions ?? [];

      /* =====================================================
         TENANT WILDCARD

         "*" applies only to this tenant membership.
         It does not grant platform access.
      ===================================================== */

      if (
        permissions.includes("*")
      ) {
        return next();
      }

      /* =====================================================
         EXPLICIT PERMISSIONS

         Every requested permission must exist.
      ===================================================== */

      const hasAllRequiredPermissions =
        requiredPermissions.every(
          (permission) =>
            permissions.includes(
              permission
            )
        );

      if (
        !hasAllRequiredPermissions
      ) {
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
        code:
          "PERMISSION_CHECK_FAILED",
        message:
          "Authorization could not be completed.",
      });
    }
  };