import {
  Request,
  Response,
  NextFunction,
} from "express";

import jwt, { JwtPayload } from "jsonwebtoken";
import prisma from "../config/prisma";
import {
  getRoleTemplatePermissions,
  isRoleTemplate,
} from "../config/roleTemplates";

/* =========================================================
   AUTHENTICATED SESSION TYPES
========================================================= */

export type SessionType =
  | "TENANT"
  | "PLATFORM";

/* =========================================================
   AUTHENTICATED USER CONTEXT

   TENANT SESSION
   - userId
   - sessionType = TENANT
   - organizationId
   - organization membership role
   - current organization permissions
   - no platform privileges implied

   PLATFORM SESSION
   - userId
   - sessionType = PLATFORM
   - platformRole
   - NO organizationId
   - NO tenant financial access implied
========================================================= */

export interface AuthUser {
  userId: string;

  sessionType: SessionType;

  rememberMe: boolean;

  organizationId?: string;

  role?: string;

  /**
   * Current effective permissions for the user's
   * organization membership.
   *
   * IMPORTANT:
   *
   * Permissions are resolved from the database on
   * every authenticated request.
   *
   * Standard roles use the current server-side
   * role template.
   *
   * CUSTOM roles use their explicitly assigned
   * membership permissions.
   */
  permissions?: string[];

  platformRole?: string;
}

export interface AuthRequest
  extends Request {
  user?: AuthUser;
}

/* =========================================================
   JWT PAYLOAD

   Permissions are intentionally NOT stored in the JWT.

   The database remains the source of truth for the
   user's current tenant access.
========================================================= */

interface ZiyaJwtPayload
  extends JwtPayload {
  userId: string;

  sessionId: string;

  sessionType: SessionType;

  rememberMe?: boolean;

  organizationId?: string;

  role?: string;

  platformRole?: string;
}

/* =========================================================
   JWT SECRET
========================================================= */

function getJwtSecret(): string {
  const secret =
    process.env.JWT_SECRET?.trim();

  if (!secret) {
    throw new Error(
      "JWT_SECRET is not configured."
    );
  }

  return secret;
}

/* =========================================================
   BEARER TOKEN
========================================================= */

function extractBearerToken(
  authorizationHeader?: string
): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const match =
    authorizationHeader.match(
      /^Bearer\s+(.+)$/i
    );

  if (!match?.[1]) {
    return null;
  }

  const token =
    match[1].trim();

  return token.length > 0
    ? token
    : null;
}

/* =========================================================
   PERMISSION NORMALIZATION

   Prisma JSON fields may come back as JsonValue.

   Normalize safely into string[] so the rest of the
   application always receives a predictable shape.
========================================================= */

function normalizePermissions(
  permissions: unknown
): string[] {
  if (!Array.isArray(permissions)) {
    return [];
  }

  return permissions
    .filter(
      (
        permission
      ): permission is string =>
        typeof permission === "string" &&
        permission.trim().length > 0
    )
    .map(
      (permission) =>
        permission.trim()
    );
}

/* =========================================================
   EFFECTIVE TENANT PERMISSIONS

   IMPORTANT RBAC RULES

   1. OWNER
      - unrestricted tenant access
      - represented internally as ["*"]

   2. STANDARD ROLE
      - permissions come from ROLE_TEMPLATES
      - stored membership permissions are NOT trusted
        as the authority for the role's standard access
      - this prevents stale permissions from surviving
        after role definitions change

   3. CUSTOM
      - explicitly assigned membership permissions
        remain authoritative

   This is what keeps the FOS permission model aligned
   with the role the user was actually assigned.
========================================================= */

function resolveTenantPermissions(
  role: string,
  storedPermissions: unknown
): string[] {
  const normalizedStoredPermissions =
    normalizePermissions(
      storedPermissions
    );

  /* =======================================================
     OWNER
  ======================================================= */

  if (role === "OWNER") {
    return ["*"];
  }

  /* =======================================================
     STANDARD ROLE

     Always use the current server-side template.
  ======================================================= */

  if (isRoleTemplate(role)) {
    return getRoleTemplatePermissions(
      role
    );
  }

  /* =======================================================
     CUSTOM ROLE

     CUSTOM permissions are explicitly assigned to
     the membership and therefore remain authoritative.
  ======================================================= */

  if (role === "CUSTOM") {
    return normalizedStoredPermissions;
  }

  /*
   * Unknown roles must never receive broad access.
   *
   * Fail closed by returning only the stored permissions.
   *
   * In normal operation this branch should not be reached
   * because role assignment validates supported roles.
   */
  return normalizedStoredPermissions;
}

/* =========================================================
   BASE JWT VALIDATION
========================================================= */

function isValidJwtPayload(
  decoded:
    | string
    | JwtPayload
): decoded is ZiyaJwtPayload {
  if (
    typeof decoded === "string" ||
    !decoded
  ) {
    return false;
  }

  if (
    typeof decoded.userId !==
      "string" ||
    decoded.userId.trim().length === 0
  ) {
    return false;
  }

  /*
   * sessionId must be present.
   * All new sessions include it.
   */
  if (
    typeof decoded.sessionId !==
      "string" ||
    decoded.sessionId.trim().length === 0
  ) {
    return false;
  }

  if (
    decoded.sessionType !==
      "TENANT" &&
    decoded.sessionType !==
      "PLATFORM"
  ) {
    return false;
  }

  if (
    decoded.sessionType ===
    "TENANT"
  ) {
    return (
      typeof decoded.organizationId ===
        "string" &&
      decoded.organizationId
        .trim()
        .length > 0 &&
      typeof decoded.role ===
        "string" &&
      decoded.role
        .trim()
        .length > 0
    );
  }

  if (
    decoded.sessionType ===
    "PLATFORM"
  ) {
    return (
      typeof decoded.platformRole ===
        "string" &&
      decoded.platformRole
        .trim()
        .length > 0
    );
  }

  return false;
}

/* =========================================================
   AUTHENTICATION MIDDLEWARE

   Order of checks:

   1. JWT present and valid signature
   2. Payload shape is correct
   3. Session exists in DB and is still active
      (catches logout — even if JWT has not expired yet)
   4. User account is active
   5. Tenant:
      - membership exists
      - membership is active
      - organization is active
      - current role/permissions are resolved
   6. Attach current authentication context to req.user

   SECURITY DESIGN:

   The JWT identifies the user/session/organization.

   The database determines the CURRENT:
   - role
   - membership status
   - permissions
   - organization status

   Therefore changing a user's role or permissions does
   not require creating a new JWT.
========================================================= */

export const authenticate =
  async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    const token =
      extractBearerToken(
        req.headers.authorization
      );

    if (!token) {
      return res
        .status(401)
        .json({
          success: false,
          code: "AUTH_REQUIRED",
          message:
            "Authentication required. Please sign in.",
        });
    }

    let secret: string;

    try {
      secret = getJwtSecret();
    } catch (error) {
      console.error(
        "[AUTH] JWT_SECRET is not configured.",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          code: "AUTH_CONFIGURATION_ERROR",
          message:
            "Authentication service is not configured correctly.",
        });
    }

    try {
      /* =====================================================
         VERIFY JWT
      ===================================================== */

      const decoded =
        jwt.verify(
          token,
          secret
        );

      if (
        !isValidJwtPayload(
          decoded
        )
      ) {
        return res
          .status(401)
          .json({
            success: false,
            code: "INVALID_SESSION",
            message:
              "Your session is not valid. Please sign in again.",
          });
      }

      const userId =
        decoded.userId.trim();

      const sessionId =
        decoded.sessionId.trim();

      /* =====================================================
         SESSION VALIDITY CHECK

         Verify the session is still active in the database.

         This makes logout effective immediately — a logged-out
         session is marked isActive: false and rejected here
         even if the JWT itself has not expired yet.

         Also refreshes lastActiveAt.
      ===================================================== */

      const session =
        await prisma.session.findUnique(
          {
            where: {
              id: sessionId,
            },

            select: {
              isActive: true,
              expiresAt: true,
              userId: true,
            },
          }
        );

      if (
        !session ||
        session.userId !== userId
      ) {
        return res
          .status(401)
          .json({
            success: false,
            code: "SESSION_NOT_FOUND",
            message:
              "Your session was not found. Please sign in again.",
          });
      }

      if (!session.isActive) {
        return res
          .status(401)
          .json({
            success: false,
            code: "SESSION_REVOKED",
            message:
              "Your session has been ended. Please sign in again.",
          });
      }

      if (
        new Date() >
        session.expiresAt
      ) {
        /*
         * Mark expired session inactive so future checks
         * are immediate.
         */
        await prisma.session.update(
          {
            where: {
              id: sessionId,
            },

            data: {
              isActive: false,
            },
          }
        );

        return res
          .status(401)
          .json({
            success: false,
            code: "SESSION_EXPIRED",
            message:
              "Your session has expired. Please sign in again.",
          });
      }

      /*
       * Refresh lastActiveAt in the background.

       * This is deliberately not awaited because it is
       * non-critical to authentication.
       */
      prisma.session
        .update({
          where: {
            id: sessionId,
          },

          data: {
            lastActiveAt:
              new Date(),
          },
        })
        .catch(() => {
          /*
           * Non-critical — never fail an authenticated request
           * because lastActiveAt could not be updated.
           */
        });

      /* =====================================================
         PLATFORM SESSION
      ===================================================== */

      if (
        decoded.sessionType ===
        "PLATFORM"
      ) {
        const user =
          await prisma.user.findUnique(
            {
              where: {
                id: userId,
              },

              select: {
                id: true,
                isActive: true,
                platformRole: true,
              },
            }
          );

        if (!user) {
          return res
            .status(401)
            .json({
              success: false,
              code: "ACCOUNT_NOT_FOUND",
              message:
                "Authenticated account was not found.",
            });
        }

        if (!user.isActive) {
          return res
            .status(403)
            .json({
              success: false,
              code: "ACCOUNT_DISABLED",
              message:
                "Your account has been disabled.",
            });
        }

        if (
          !user.platformRole ||
          user.platformRole !==
            decoded.platformRole
        ) {
          return res
            .status(403)
            .json({
              success: false,
              code: "PLATFORM_ACCESS_REVOKED",
              message:
                "Platform access is no longer available.",
            });
        }

        /*
         * Platform users do not receive tenant permissions.
         * Platform access is controlled separately.
         */
        req.user = {
          userId,
          sessionType:
            "PLATFORM",
          rememberMe:
            decoded.rememberMe ===
            true,
          platformRole:
            user.platformRole,
        };

        return next();
      }

      /* =====================================================
         TENANT SESSION
      ===================================================== */

      const organizationId =
        decoded.organizationId!.trim();

      /*
       * IMPORTANT:
       *
       * We deliberately load the membership from the database
       * on every authenticated request.
       *
       * This gives us the CURRENT role and membership state.
       *
       * The effective permissions are then resolved using:
       *
       *   OWNER
       *     -> unrestricted
       *
       *   STANDARD ROLE
       *     -> current ROLE_TEMPLATES definition
       *
       *   CUSTOM
       *     -> explicitly assigned membership permissions
       *
       * This prevents stale permissions from causing a user
       * to see or access modules outside their assigned role.
       */

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
              permissions: true,
              isActive: true,

              user: {
                select: {
                  id: true,
                  isActive: true,
                },
              },

              organization: {
                select: {
                  id: true,
                  status: true,
                },
              },
            },
          }
        );

      /* =====================================================
         MEMBERSHIP EXISTENCE
      ===================================================== */

      if (!membership) {
        return res
          .status(403)
          .json({
            success: false,
            code: "ORGANIZATION_ACCESS_REVOKED",
            message:
              "You no longer have access to this organization.",
          });
      }

      /* =====================================================
         USER ACCOUNT STATUS
      ===================================================== */

      if (
        !membership.user.isActive
      ) {
        return res
          .status(403)
          .json({
            success: false,
            code: "ACCOUNT_DISABLED",
            message:
              "Your account has been disabled.",
          });
      }

      /* =====================================================
         MEMBERSHIP STATUS
      ===================================================== */

      if (
        !membership.isActive
      ) {
        return res
          .status(403)
          .json({
            success: false,
            code: "MEMBERSHIP_DISABLED",
            message:
              "Your access to this organization has been disabled.",
          });
      }

      /* =====================================================
         ORGANIZATION STATUS
      ===================================================== */

      if (
        membership.organization
          .status !== "ACTIVE"
      ) {
        return res
          .status(403)
          .json({
            success: false,
            code: "ORGANIZATION_DISABLED",
            message:
              "This organization is not currently active.",
          });
      }

      /* =====================================================
         CURRENT TENANT ROLE + PERMISSIONS
      ===================================================== */

      const effectivePermissions =
        resolveTenantPermissions(
          membership.role,
          membership.permissions
        );

      /* =====================================================
         ATTACH AUTH CONTEXT

         The frontend/backend can now access:

         req.user.userId
         req.user.sessionType
         req.user.organizationId
         req.user.role
         req.user.permissions
      ===================================================== */

      req.user = {
        userId,

        sessionType:
          "TENANT",

        rememberMe:
          decoded.rememberMe ===
          true,

        organizationId,

        role:
          membership.role,

        permissions:
          effectivePermissions,
      };

      return next();
    } catch (error) {
      /* =====================================================
         JWT EXPIRED
      ===================================================== */

      if (
        error instanceof
        jwt.TokenExpiredError
      ) {
        return res
          .status(401)
          .json({
            success: false,
            code: "SESSION_EXPIRED",
            message:
              "Your session has expired. Please sign in again.",
          });
      }

      /* =====================================================
         JWT NOT ACTIVE
      ===================================================== */

      if (
        error instanceof
        jwt.NotBeforeError
      ) {
        return res
          .status(401)
          .json({
            success: false,
            code: "SESSION_NOT_ACTIVE",
            message:
              "Your session is not active yet. Please sign in again.",
          });
      }

      /* =====================================================
         INVALID JWT
      ===================================================== */

      if (
        error instanceof
        jwt.JsonWebTokenError
      ) {
        console.warn(
          "[AUTH] JWT verification failed:",
          error.message
        );

        return res
          .status(401)
          .json({
            success: false,
            code: "INVALID_SESSION",
            message:
              "Your session is not valid. Please sign in again.",
          });
      }

      /* =====================================================
         UNEXPECTED ERROR
      ===================================================== */

      console.error(
        "[AUTH] Unexpected authentication error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          code: "AUTH_ERROR",
          message:
            "Authentication could not be completed.",
        });
    }
  };