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
         OWNER

         IMPORTANT SECURITY DESIGN:

         The CURRENT DATABASE MEMBERSHIP is authoritative
         for determining whether the user is currently the
         tenant OWNER.

         This check intentionally happens BEFORE the stale
         JWT/request-role consistency check.

         Why:
         - A newly created/promoted OWNER may still have an
           older tenant session containing the previous role.
         - The current OrganizationMember record is the source
           of truth for the user's current tenant role.
         - A legitimate current OWNER must therefore not be
           blocked simply because an old session still contains
           the previous role.

         This does NOT grant platform privileges.

         OWNER receives full access ONLY inside the current
         organization identified by req.user.organizationId.

         This also does NOT weaken downgrade protection.

         If an OWNER is changed in the database to a different
         role, the current membership is no longer OWNER, so
         execution continues to the role-consistency check.
         The stale OWNER session will then be rejected.
      ===================================================== */

      const currentMembershipRole =
        String(
          membership.role ?? ""
        )
          .trim()
          .toUpperCase();

      if (
        currentMembershipRole ===
        "OWNER"
      ) {
        return next();
      }

      /* =====================================================
         ROLE CONSISTENCY

         For non-OWNER roles, the authentication context must
         still match the current database membership.

         This prevents stale sessions from retaining access
         after a role downgrade or reassignment.

         Comparison is normalized so harmless casing or
         whitespace differences cannot cause inconsistent
         authorization behavior.
      ===================================================== */

      const authenticatedRole =
        String(
          req.user.role ?? ""
        )
          .trim()
          .toUpperCase();

      if (
        authenticatedRole &&
        authenticatedRole !==
          currentMembershipRole
      ) {
        return res.status(403).json({
          success: false,
          code: "ROLE_CHANGED",
          message:
            "Your access permissions have changed. Please sign in again.",
        });
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

         It does NOT grant platform access or access to other
         organizations.
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

   requireOwner() is used for operations that specifically
   require the organization OWNER rather than simply a
   permission such as "user.manage".
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

         The database membership is checked directly so that
         OWNER authorization reflects the current tenant role.
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

         A platform account must not use tenant OWNER
         administration through this middleware.

         Tenant OWNER authorization remains tenant-scoped.
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

         The CURRENT database membership is authoritative.

         This means a tenant user who is currently OWNER can
         pass this check even if an older session contains a
         stale role value.

         Platform privileges are NOT granted here.
      ===================================================== */

      const currentMembershipRole =
        String(
          membership.role ?? ""
        )
          .trim()
          .toUpperCase();

      if (
        currentMembershipRole !==
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