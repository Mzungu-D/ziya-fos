import {
  Request,
  Response,
  NextFunction,
} from "express";

import jwt, { JwtPayload } from "jsonwebtoken";
import prisma from "../config/prisma";

/* =========================================================
   AUTHENTICATED USER CONTEXT

   Every authenticated request carries:
   - userId
   - organizationId
   - CURRENT organization membership role

   The JWT identifies the requested session/tenant.
   Database membership remains the source of truth.
========================================================= */

export interface AuthUser {
  userId: string;
  organizationId: string;
  role: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

/* =========================================================
   JWT PAYLOAD
========================================================= */

interface ZiyaJwtPayload extends JwtPayload {
  userId: string;
  organizationId: string;
  role: string;
}

/* =========================================================
   JWT SECRET
========================================================= */

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();

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

  const match = authorizationHeader.match(
    /^Bearer\s+(.+)$/i
  );

  if (!match?.[1]) {
    return null;
  }

  const token = match[1].trim();

  return token.length > 0
    ? token
    : null;
}

/* =========================================================
   JWT PAYLOAD VALIDATION
========================================================= */

function isValidJwtPayload(
  decoded: string | JwtPayload
): decoded is ZiyaJwtPayload {
  if (
    typeof decoded === "string" ||
    !decoded
  ) {
    return false;
  }

  return (
    typeof decoded.userId === "string" &&
    decoded.userId.trim().length > 0 &&

    typeof decoded.organizationId === "string" &&
    decoded.organizationId.trim().length > 0 &&

    typeof decoded.role === "string" &&
    decoded.role.trim().length > 0
  );
}

/* =========================================================
   AUTHENTICATION MIDDLEWARE

   SECURITY MODEL

   1. Verify JWT signature and expiry.
   2. Extract user + organization identity.
   3. Re-check the database.
   4. User must still be active.
   5. Membership must still exist and be active.
   6. Organization must still be active.
   7. CURRENT membership role replaces JWT role.

   Therefore:
   - Removing a membership revokes access immediately.
   - Disabling membership revokes access immediately.
   - Disabling user revokes access immediately.
   - Disabling organization revokes access immediately.
   - Role changes take effect immediately.
========================================================= */

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const token = extractBearerToken(
    req.headers.authorization
  );

  if (!token) {
    return res.status(401).json({
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

    return res.status(500).json({
      success: false,
      code: "AUTH_CONFIGURATION_ERROR",
      message:
        "Authentication service is not configured correctly.",
    });
  }

  try {
    /* =====================================================
       VERIFY TOKEN
    ===================================================== */

    const decoded = jwt.verify(
      token,
      secret
    );

    if (!isValidJwtPayload(decoded)) {
      return res.status(401).json({
        success: false,
        code: "INVALID_SESSION",
        message:
          "Your session is not valid. Please sign in again.",
      });
    }

    const userId =
      decoded.userId.trim();

    const organizationId =
      decoded.organizationId.trim();

    /* =====================================================
       VERIFY CURRENT DATABASE ACCESS

       Do NOT trust the JWT alone.

       The membership record is the current authority
       for organization access and role.
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
          role: true,
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

    /* =====================================================
       MEMBERSHIP MUST EXIST
    ===================================================== */

    if (!membership) {
      return res.status(403).json({
        success: false,
        code: "ORGANIZATION_ACCESS_REVOKED",
        message:
          "You no longer have access to this organization.",
      });
    }

    /* =====================================================
       USER MUST STILL BE ACTIVE
    ===================================================== */

    if (!membership.user.isActive) {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_DISABLED",
        message:
          "Your account has been disabled.",
      });
    }

    /* =====================================================
       MEMBERSHIP MUST STILL BE ACTIVE
    ===================================================== */

    if (!membership.isActive) {
      return res.status(403).json({
        success: false,
        code: "MEMBERSHIP_DISABLED",
        message:
          "Your access to this organization has been disabled.",
      });
    }

    /* =====================================================
       ORGANIZATION MUST STILL BE ACTIVE
    ===================================================== */

    if (
      membership.organization.status !==
      "ACTIVE"
    ) {
      return res.status(403).json({
        success: false,
        code: "ORGANIZATION_DISABLED",
        message:
          "This organization is not currently active.",
      });
    }

    /* =====================================================
       ATTACH TRUSTED CURRENT CONTEXT

       IMPORTANT:
       Role comes from the database membership,
       NOT from the JWT.

       If an administrator changes the user's role,
       the change therefore takes effect immediately.
    ===================================================== */

    req.user = {
      userId,
      organizationId,
      role: membership.role,
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
      return res.status(401).json({
        success: false,
        code: "SESSION_EXPIRED",
        message:
          "Your session has expired. Please sign in again.",
      });
    }

    /* =====================================================
       JWT NOT ACTIVE YET
    ===================================================== */

    if (
      error instanceof
      jwt.NotBeforeError
    ) {
      return res.status(401).json({
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

      return res.status(401).json({
        success: false,
        code: "INVALID_SESSION",
        message:
          "Your session is not valid. Please sign in again.",
      });
    }

    /* =====================================================
       DATABASE / UNEXPECTED AUTH ERROR
    ===================================================== */

    console.error(
      "[AUTH] Unexpected authentication error:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "AUTH_ERROR",
      message:
        "Authentication could not be completed.",
    });
  }
};