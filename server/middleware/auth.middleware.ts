import {
  Request,
  Response,
  NextFunction,
} from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

/* =========================================================
   AUTHENTICATED USER CONTEXT

   Every authenticated request carries:
   - userId
   - organizationId
   - organization membership role

   This is the foundation of tenant isolation.
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

  return token.length > 0 ? token : null;
}

/* =========================================================
   PAYLOAD VALIDATION
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
========================================================= */

export const authenticate = (
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

    req.user = {
      userId: decoded.userId,
      organizationId: decoded.organizationId,
      role: decoded.role,
    };

    return next();
  } catch (error) {
    if (
      error instanceof jwt.TokenExpiredError
    ) {
      return res.status(401).json({
        success: false,
        code: "SESSION_EXPIRED",
        message:
          "Your session has expired. Please sign in again.",
      });
    }

    if (
      error instanceof jwt.NotBeforeError
    ) {
      return res.status(401).json({
        success: false,
        code: "SESSION_NOT_ACTIVE",
        message:
          "Your session is not active yet. Please sign in again.",
      });
    }

    if (
      error instanceof jwt.JsonWebTokenError
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