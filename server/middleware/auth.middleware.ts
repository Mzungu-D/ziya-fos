import {
  Request,
  Response,
  NextFunction,
} from "express";

import jwt, {
  JwtPayload,
} from "jsonwebtoken";

import prisma from "../config/prisma";

import {
  resolveEffectivePermissions,
} from "../services/authorization.service";


/* =========================================================
   AUTHENTICATED SESSION TYPES
========================================================= */

export type SessionType =
  | "TENANT"
  | "PLATFORM";


/* =========================================================
   AUTHENTICATED USER CONTEXT

   TENANT SESSION
   ---------------------------------------------------------
   - userId
   - sessionType = TENANT
   - organizationId
   - current organization membership role
   - current effective organization permissions
   - no platform privileges implied

   PLATFORM SESSION
   ---------------------------------------------------------
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
   * These permissions are resolved from the CURRENT
   * database membership on every authenticated request.
   *
   * The JWT does NOT contain permissions.
   *
   * Standard roles use the current server-side role
   * template.
   *
   * CUSTOM roles use explicitly assigned membership
   * permissions.
   *
   * Unknown roles receive no permissions.
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

   SECURITY PRINCIPLE

   Permissions are intentionally NOT stored in the JWT.

   The JWT identifies:

   - user
   - session
   - session type
   - tenant

   The database remains the source of truth for:

   - current membership
   - current role
   - current permissions
   - account status
   - organization status
========================================================= */

interface ZiyaJwtPayload
  extends JwtPayload {
  userId: string;

  sessionId: string;

  sessionType: SessionType;

  rememberMe?: boolean;

  organizationId?: string;

  /**
   * Retained for session compatibility.

   * IMPORTANT:
   * This value is NOT trusted for current authorization.
   *
   * The current role is always loaded from the database.
   */
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
      "JWT_SECRET is not configured.",
    );
  }

  return secret;
}


/* =========================================================
   BEARER TOKEN
========================================================= */

function extractBearerToken(
  authorizationHeader?: string,
): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const match =
    authorizationHeader.match(
      /^Bearer\s+(.+)$/i,
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
   BASE JWT VALIDATION
========================================================= */

function isValidJwtPayload(
  decoded:
    | string
    | JwtPayload,
): decoded is ZiyaJwtPayload {
  if (
    typeof decoded === "string" ||
    !decoded
  ) {
    return false;
  }

  /* -------------------------------------------------------
     USER ID
  ------------------------------------------------------- */

  if (
    typeof decoded.userId !==
      "string" ||
    decoded.userId.trim().length === 0
  ) {
    return false;
  }


  /* -------------------------------------------------------
     SESSION ID

     Every production session must have a database-backed
     session ID so logout/revocation can take effect
     immediately.
  ------------------------------------------------------- */

  if (
    typeof decoded.sessionId !==
      "string" ||
    decoded.sessionId.trim().length === 0
  ) {
    return false;
  }


  /* -------------------------------------------------------
     SESSION TYPE
  ------------------------------------------------------- */

  if (
    decoded.sessionType !==
      "TENANT" &&
    decoded.sessionType !==
      "PLATFORM"
  ) {
    return false;
  }


  /* -------------------------------------------------------
     TENANT SESSION

     A tenant session MUST identify a tenant.

     The role contained in the JWT is only legacy/session
     metadata. It is NOT trusted for authorization.
  ------------------------------------------------------- */

  if (
    decoded.sessionType ===
    "TENANT"
  ) {
    return (
      typeof decoded.organizationId ===
        "string" &&
      decoded.organizationId
        .trim()
        .length > 0
    );
  }


  /* -------------------------------------------------------
     PLATFORM SESSION
  ------------------------------------------------------- */

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

   ORDER OF SECURITY CHECKS

   1. JWT exists
   2. JWT signature is valid
   3. JWT payload structure is valid
   4. Database session exists
   5. Database session belongs to authenticated user
   6. Database session is active
   7. Database session has not expired
   8. User account is active
   9. Tenant membership exists
   10. Tenant membership is active
   11. Tenant organization is active
   12. Current database role is resolved
   13. Current database permissions are resolved
   14. Authentication context is attached to req.user

   SECURITY PRINCIPLE

   The JWT proves the identity of the session.

   The DATABASE proves what the user is currently allowed
   to do.

   Therefore:

   - changing role takes effect immediately
   - removing membership takes effect immediately
   - disabling a user takes effect immediately
   - disabling an organization takes effect immediately
   - changing CUSTOM permissions takes effect immediately
   - changing a standard role template takes effect without
     requiring users to log in again

   The frontend is never the security boundary.
========================================================= */

export const authenticate =
  async (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) => {
    /* =====================================================
       EXTRACT TOKEN
    ===================================================== */

    const token =
      extractBearerToken(
        req.headers.authorization,
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


    /* =====================================================
       LOAD JWT SECRET
    ===================================================== */

    let secret: string;

    try {
      secret =
        getJwtSecret();
    } catch (error) {
      console.error(
        "[AUTH] JWT_SECRET is not configured.",
        error,
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
      /* ===================================================
         VERIFY JWT

         Do not decode without verification.
         Never trust client-supplied JWT claims before the
         signature has been verified.
      =================================================== */

      const decoded =
        jwt.verify(
          token,
          secret,
        );

      if (
        !isValidJwtPayload(
          decoded,
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


      /* ===================================================
         DATABASE SESSION VALIDATION

         This makes logout/revocation effective immediately.

         A valid JWT is NOT sufficient to remain authenticated.
      =================================================== */

      const session =
        await prisma.session.findUnique({
          where: {
            id: sessionId,
          },

          select: {
            isActive: true,
            expiresAt: true,
            userId: true,
          },
        });


      /* ---------------------------------------------------
         SESSION MUST EXIST AND BELONG TO THE USER
      --------------------------------------------------- */

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


      /* ---------------------------------------------------
         SESSION MUST BE ACTIVE
      --------------------------------------------------- */

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


      /* ---------------------------------------------------
         SESSION MUST NOT BE EXPIRED
      --------------------------------------------------- */

      if (
        new Date() >
        session.expiresAt
      ) {
        /**
         * Mark the session inactive so future requests
         * are rejected immediately.
         */
        await prisma.session.update({
          where: {
            id: sessionId,
          },

          data: {
            isActive: false,
          },
        });

        return res
          .status(401)
          .json({
            success: false,
            code: "SESSION_EXPIRED",
            message:
              "Your session has expired. Please sign in again.",
          });
      }


      /* ===================================================
         REFRESH SESSION ACTIVITY

         This is deliberately non-blocking.

         Failure to update activity must never turn an
         otherwise valid authenticated request into a failure.
      =================================================== */

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
           * Non-critical.
           *
           * Never fail an authenticated request merely
           * because activity tracking failed.
           */
        });


      /* ===================================================
         PLATFORM SESSION

         Platform access is completely separate from tenant
         financial authorization.
      =================================================== */

      if (
        decoded.sessionType ===
        "PLATFORM"
      ) {
        const user =
          await prisma.user.findUnique({
            where: {
              id: userId,
            },

            select: {
              id: true,
              isActive: true,
              platformRole: true,
            },
          });


        /* -------------------------------------------------
           PLATFORM USER MUST EXIST
        ------------------------------------------------- */

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


        /* -------------------------------------------------
           PLATFORM USER MUST BE ACTIVE
        ------------------------------------------------- */

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


        /* -------------------------------------------------
           PLATFORM ROLE MUST STILL MATCH DATABASE

           The JWT platformRole is not authoritative.
        ------------------------------------------------- */

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


        /* -------------------------------------------------
           PLATFORM USERS RECEIVE NO TENANT PERMISSIONS
        ------------------------------------------------- */

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


      /* ===================================================
         TENANT SESSION
      =================================================== */

      const organizationId =
        decoded.organizationId!.trim();


      /* ===================================================
         LOAD CURRENT MEMBERSHIP

         SECURITY CRITICAL

         NEVER use the role or permissions from the JWT
         as the current authorization source.

         Always query the current membership.

         This ensures role changes and permission changes
         become effective immediately.
      =================================================== */

      const membership =
        await prisma.organizationMember.findUnique({
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
        });


      /* ===================================================
         MEMBERSHIP MUST EXIST
      =================================================== */

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


      /* ===================================================
         USER ACCOUNT STATUS
      =================================================== */

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


      /* ===================================================
         MEMBERSHIP STATUS
      =================================================== */

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


      /* ===================================================
         ORGANIZATION STATUS
      =================================================== */

      if (
        membership.organization.status !==
        "ACTIVE"
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


      /* ===================================================
         CURRENT TENANT ROLE

         IMPORTANT

         The role below comes from the database.

         The JWT role is deliberately ignored.

         This prevents a stale JWT from retaining an old
         role after the membership has been changed.
      =================================================== */

      const currentRole =
        typeof membership.role ===
        "string"
          ? membership.role
              .trim()
              .toUpperCase()
          : "";


      /* ===================================================
         INVALID / UNKNOWN ROLE

         SECURITY REQUIREMENT

         Unknown roles must fail closed.

         Do NOT allow an unknown role to inherit the
         permissions stored on the membership.

         resolveEffectivePermissions() itself also fails
         closed, but rejecting the session here provides an
         additional protection boundary.
      =================================================== */

      if (!currentRole) {
        console.error(
          "[AUTH] Tenant membership has no valid role.",
          {
            userId,
            organizationId,
          },
        );

        return res
          .status(403)
          .json({
            success: false,
            code: "INVALID_MEMBERSHIP_ROLE",
            message:
              "Your organization access configuration is invalid.",
          });
      }


      /* ===================================================
         CURRENT EFFECTIVE PERMISSIONS

         SINGLE AUTHORIZATION SOURCE

         Standard role:
           -> ROLE_TEMPLATES

         CUSTOM:
           -> membership.permissions

         OWNER:
           -> ["*"]

         Unknown:
           -> []

         Stored membership permissions are NEVER allowed
         to expand a standard role.
      =================================================== */

      const effectivePermissions =
        resolveEffectivePermissions({
          role: currentRole,
          permissions:
            membership.permissions,
          isActive:
            membership.isActive,
        });


      /* ===================================================
         FAIL CLOSED FOR UNKNOWN ROLES

         The authorization service returns [] for an
         unsupported role.

         Do not authenticate a malformed/unknown role into
         a tenant session.
      =================================================== */

      if (
        effectivePermissions.length ===
          0 &&
        currentRole !== "CUSTOM"
      ) {
        console.error(
          "[AUTH] Tenant membership resolved to no permissions.",
          {
            userId,
            organizationId,
            role: currentRole,
          },
        );

        return res
          .status(403)
          .json({
            success: false,
            code: "INVALID_MEMBERSHIP_ROLE",
            message:
              "Your organization access configuration is invalid.",
          });
      }


      /* ===================================================
         ATTACH CURRENT AUTH CONTEXT

         IMPORTANT

         req.user.permissions now represents the CURRENT
         database-backed effective permission set.

         It does not come from the JWT.
      =================================================== */

      req.user = {
        userId,

        sessionType:
          "TENANT",

        rememberMe:
          decoded.rememberMe ===
          true,

        organizationId,

        role:
          currentRole,

        permissions:
          effectivePermissions,
      };


      /* ===================================================
         CONTINUE
      =================================================== */

      return next();

    } catch (error) {

      /* ===================================================
         JWT EXPIRED
      =================================================== */

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


      /* ===================================================
         JWT NOT ACTIVE
      =================================================== */

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


      /* ===================================================
         INVALID JWT
      =================================================== */

      if (
        error instanceof
        jwt.JsonWebTokenError
      ) {
        console.warn(
          "[AUTH] JWT verification failed:",
          error.message,
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


      /* ===================================================
         UNEXPECTED ERROR

         Do not expose internal database/authentication
         details to the client.
      =================================================== */

      console.error(
        "[AUTH] Unexpected authentication error:",
        error,
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