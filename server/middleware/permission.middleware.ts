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

   IMPORTANT:

   Authentication middleware is responsible for resolving
   the CURRENT effective permissions.

   This middleware therefore uses:

       req.user.permissions

   rather than independently trusting the raw permissions
   JSON stored in OrganizationMember.

   This guarantees that UI visibility and backend API
   authorization use the SAME effective RBAC result.
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
        req.user.sessionType !==
        "TENANT"
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
         CURRENT MEMBERSHIP VALIDATION

         We still verify the membership here because this
         middleware is a security boundary.

         Authentication has already loaded the membership,
         but authorization must independently ensure that
         the tenant membership remains valid.
      ===================================================== */

      const membership =
        await prisma.organizationMember.findUnique(
          {
            where: {
              userId_organizationId: {
                userId,
                organizationId,
              },
            },

            select: {
              id: true,
              role: true,
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
          }
        );

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

      if (
        !membership.user.isActive
      ) {
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
        membership.organization
          .status !== "ACTIVE"
      ) {
        return res.status(403).json({
          success: false,
          code: "ORGANIZATION_INACTIVE",
          message:
            "This organization is not active.",
        });
      }

      /* =====================================================
         ROLE CONSISTENCY

         Authentication resolves the current effective role
         and permissions.

         Make sure the membership role has not changed
         between authentication and authorization.

         If it has changed, reject the request instead of
         authorizing against stale request context.
      ===================================================== */

      if (
        req.user.role &&
        req.user.role !==
          membership.role
      ) {
        return res.status(403).json({
          success: false,
          code: "ROLE_CHANGED",
          message:
            "Your access permissions have changed. Please sign in again.",
        });
      }

      /* =====================================================
         OWNER

         OWNER has full access only inside the organization
         represented by this tenant session.

         OWNER does NOT receive platform privileges.
      ===================================================== */

      if (
        membership.role ===
        "OWNER"
      ) {
        return next();
      }

      /* =====================================================
         EFFECTIVE PERMISSIONS

         IMPORTANT:

         Do NOT use membership.permissions here.

         auth.middleware.ts has already resolved the current
         effective permissions according to:

         OWNER
             -> ["*"]

         STANDARD ROLE
             -> ROLE_TEMPLATES

         CUSTOM
             -> explicitly assigned permissions

         Using req.user.permissions keeps every backend
         authorization decision consistent with the same
         RBAC source.
      ===================================================== */

      const permissions =
        Array.isArray(
          req.user.permissions
        )
          ? req.user.permissions
          : [];

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
         REQUIRED PERMISSIONS

         Every requested permission must exist.

         Example:

         requirePermission(
           "account.view"
         )

         requires:

         account.view
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

      /* =====================================================
         AUTHORIZED
      ===================================================== */

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

/* =========================================================
   TENANT OWNER-ONLY MIDDLEWARE

   OWNER is the highest tenant-side administrative role.

   This is intentionally separate from platform
   administration.
========================================================= */

export const requireOwner =
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
      ===================================================== */

      if (
        req.user.sessionType !==
        "TENANT"
      ) {
        return res.status(403).json({
          success: false,
          code: "TENANT_SESSION_REQUIRED",
          message:
            "A tenant session is required.",
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
         CURRENT MEMBERSHIP
      ===================================================== */

      const membership =
        await prisma.organizationMember.findUnique(
          {
            where: {
              userId_organizationId: {
                userId,
                organizationId,
              },
            },

            select: {
              role: true,
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
                  platformRole: true,
                },
              },
            },
          }
        );

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
         MEMBERSHIP ACTIVE
      ===================================================== */

      if (
        !membership.isActive
      ) {
        return res.status(403).json({
          success: false,
          code: "MEMBERSHIP_INACTIVE",
          message:
            "Your organization membership is inactive.",
        });
      }

      /* =====================================================
         USER ACTIVE
      ===================================================== */

      if (
        !membership.user.isActive
      ) {
        return res.status(403).json({
          success: false,
          code: "USER_INACTIVE",
          message:
            "This user account is inactive.",
        });
      }

      /* =====================================================
         PLATFORM ACCOUNT RESTRICTION
      ===================================================== */

      if (
        membership.user
          .platformRole
      ) {
        return res.status(403).json({
          success: false,
          code: "PLATFORM_ACCOUNT_RESTRICTED",
          message:
            "Platform accounts cannot use tenant administration.",
        });
      }

      /* =====================================================
         ORGANIZATION ACTIVE
      ===================================================== */

      if (
        membership.organization
          .status !== "ACTIVE"
      ) {
        return res.status(403).json({
          success: false,
          code: "ORGANIZATION_INACTIVE",
          message:
            "This organization is not active.",
        });
      }

      /* =====================================================
         OWNER REQUIRED
      ===================================================== */

      if (
        membership.role !==
        "OWNER"
      ) {
        return res.status(403).json({
          success: false,
          code: "OWNER_REQUIRED",
          message:
            "Only the organization Owner can access this resource.",
        });
      }

      return next();
    } catch (error) {
      console.error(
        "[OWNER] Authorization failed:",
        error
      );

      return res.status(500).json({
        success: false,
        code:
          "OWNER_CHECK_FAILED",
        message:
          "Authorization could not be completed.",
      });
    }
  };