import {
  Request,
  Response,
  NextFunction,
} from "express";

import jwt, { JwtPayload } from "jsonwebtoken";
import prisma from "../config/prisma";

/* =========================================================
   AUTHENTICATED SESSION TYPES
========================================================= */

export type SessionType = "TENANT" | "PLATFORM";

/* =========================================================
   AUTHENTICATED USER CONTEXT

   TENANT SESSION
   - userId
   - sessionType = TENANT
   - organizationId
   - organization membership role
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

  platformRole?: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

/* =========================================================
   JWT PAYLOAD
========================================================= */

interface ZiyaJwtPayload extends JwtPayload {
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
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) throw new Error("JWT_SECRET is not configured.");
  return secret;
}

/* =========================================================
   BEARER TOKEN
========================================================= */

function extractBearerToken(authorizationHeader?: string): string | null {
  if (!authorizationHeader) return null;
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) return null;
  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

/* =========================================================
   BASE JWT VALIDATION
========================================================= */

function isValidJwtPayload(
  decoded: string | JwtPayload
): decoded is ZiyaJwtPayload {
  if (typeof decoded === "string" || !decoded) return false;

  if (
    typeof decoded.userId !== "string" ||
    decoded.userId.trim().length === 0
  ) {
    return false;
  }

  // sessionId must be present — all new sessions include it
  if (
    typeof decoded.sessionId !== "string" ||
    decoded.sessionId.trim().length === 0
  ) {
    return false;
  }

  if (
    decoded.sessionType !== "TENANT" &&
    decoded.sessionType !== "PLATFORM"
  ) {
    return false;
  }

  if (decoded.sessionType === "TENANT") {
    return (
      typeof decoded.organizationId === "string" &&
      decoded.organizationId.trim().length > 0 &&
      typeof decoded.role === "string" &&
      decoded.role.trim().length > 0
    );
  }

  if (decoded.sessionType === "PLATFORM") {
    return (
      typeof decoded.platformRole === "string" &&
      decoded.platformRole.trim().length > 0
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
   5. Tenant: membership is active and org is active
========================================================= */

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    return res.status(401).json({
      success: false,
      code: "AUTH_REQUIRED",
      message: "Authentication required. Please sign in.",
    });
  }

  let secret: string;

  try {
    secret = getJwtSecret();
  } catch (error) {
    console.error("[AUTH] JWT_SECRET is not configured.", error);

    return res.status(500).json({
      success: false,
      code: "AUTH_CONFIGURATION_ERROR",
      message: "Authentication service is not configured correctly.",
    });
  }

  try {
    const decoded = jwt.verify(token, secret);

    if (!isValidJwtPayload(decoded)) {
      return res.status(401).json({
        success: false,
        code: "INVALID_SESSION",
        message: "Your session is not valid. Please sign in again.",
      });
    }

    const userId = decoded.userId.trim();
    const sessionId = decoded.sessionId.trim();

    /* =====================================================
       SESSION VALIDITY CHECK

       Verify the session is still active in the database.
       This is what makes logout truly work — a logged-out
       session is marked isActive: false and rejected here
       even if the JWT itself has not expired yet.

       Also refreshes lastActiveAt so we can track usage.
    ===================================================== */

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { isActive: true, expiresAt: true, userId: true },
    });

    if (!session || session.userId !== userId) {
      return res.status(401).json({
        success: false,
        code: "SESSION_NOT_FOUND",
        message: "Your session was not found. Please sign in again.",
      });
    }

    if (!session.isActive) {
      return res.status(401).json({
        success: false,
        code: "SESSION_REVOKED",
        message: "Your session has been ended. Please sign in again.",
      });
    }

    if (new Date() > session.expiresAt) {
      // Mark it inactive so future checks are instant
      await prisma.session.update({
        where: { id: sessionId },
        data: { isActive: false },
      });

      return res.status(401).json({
        success: false,
        code: "SESSION_EXPIRED",
        message: "Your session has expired. Please sign in again.",
      });
    }

    // Refresh lastActiveAt in the background — do not await
    prisma.session
      .update({
        where: { id: sessionId },
        data: { lastActiveAt: new Date() },
      })
      .catch(() => {
        // Non-critical — never fail a request over this
      });

    /* =====================================================
       PLATFORM SESSION
    ===================================================== */

    if (decoded.sessionType === "PLATFORM") {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          isActive: true,
          platformRole: true,
        },
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          code: "ACCOUNT_NOT_FOUND",
          message: "Authenticated account was not found.",
        });
      }

      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          code: "ACCOUNT_DISABLED",
          message: "Your account has been disabled.",
        });
      }

      if (
        !user.platformRole ||
        user.platformRole !== decoded.platformRole
      ) {
        return res.status(403).json({
          success: false,
          code: "PLATFORM_ACCESS_REVOKED",
          message: "Platform access is no longer available.",
        });
      }

      req.user = {
        userId,
        sessionType: "PLATFORM",
        rememberMe: decoded.rememberMe === true,
        platformRole: user.platformRole,
      };

      return next();
    }

    /* =====================================================
       TENANT SESSION
    ===================================================== */

    const organizationId = decoded.organizationId!.trim();

    const membership = await prisma.organizationMember.findUnique({
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

    if (!membership) {
      return res.status(403).json({
        success: false,
        code: "ORGANIZATION_ACCESS_REVOKED",
        message: "You no longer have access to this organization.",
      });
    }

    if (!membership.user.isActive) {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_DISABLED",
        message: "Your account has been disabled.",
      });
    }

    if (!membership.isActive) {
      return res.status(403).json({
        success: false,
        code: "MEMBERSHIP_DISABLED",
        message: "Your access to this organization has been disabled.",
      });
    }

    if (membership.organization.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        code: "ORGANIZATION_DISABLED",
        message: "This organization is not currently active.",
      });
    }

    req.user = {
      userId,
      sessionType: "TENANT",
      rememberMe: decoded.rememberMe === true,
      organizationId,
      role: membership.role,
    };

    return next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        code: "SESSION_EXPIRED",
        message: "Your session has expired. Please sign in again.",
      });
    }

    if (error instanceof jwt.NotBeforeError) {
      return res.status(401).json({
        success: false,
        code: "SESSION_NOT_ACTIVE",
        message: "Your session is not active yet. Please sign in again.",
      });
    }

    if (error instanceof jwt.JsonWebTokenError) {
      console.warn("[AUTH] JWT verification failed:", error.message);

      return res.status(401).json({
        success: false,
        code: "INVALID_SESSION",
        message: "Your session is not valid. Please sign in again.",
      });
    }

    console.error("[AUTH] Unexpected authentication error:", error);

    return res.status(500).json({
      success: false,
      code: "AUTH_ERROR",
      message: "Authentication could not be completed.",
    });
  }
};