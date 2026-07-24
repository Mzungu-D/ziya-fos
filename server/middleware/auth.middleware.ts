import {
  Request,
  Response,
  NextFunction,
} from "express";
import jwt, {
  JwtPayload,
  TokenExpiredError,
  JsonWebTokenError,
  NotBeforeError,
} from "jsonwebtoken";

/* =========================================================
   TYPES
========================================================= */

export interface AuthUser {
  userId: string;
  role: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

/* =========================================================
   JWT SECRET
========================================================= */

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();

  if (!secret) {
    throw new Error(
      "JWT_SECRET is not configured. Authentication cannot start safely."
    );
  }

  return secret;
}

/* =========================================================
   TOKEN EXTRACTION
========================================================= */

function extractBearerToken(
  authorizationHeader?: string
): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const parts = authorizationHeader.trim().split(/\s+/);

  if (parts.length !== 2) {
    return null;
  }

  const [scheme, token] = parts;

  if (
    scheme.toLowerCase() !== "bearer" ||
    !token?.trim()
  ) {
    return null;
  }

  return token.trim();
}

/* =========================================================
   PAYLOAD VALIDATION
========================================================= */

function isValidPayload(
  decoded: string | JwtPayload
): decoded is JwtPayload & AuthUser {
  if (
    typeof decoded === "string" ||
    !decoded ||
    typeof decoded !== "object"
  ) {
    return false;
  }

  return (
    typeof decoded.userId === "string" &&
    decoded.userId.trim().length > 0 &&
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
      message: "Authentication required. Please sign in.",
    });
  }

  let secret: string;

  try {
    secret = getJwtSecret();
  } catch (error) {
    console.error(
      "[AUTH] JWT configuration error:",
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
    const decoded = jwt.verify(token, secret);

    if (!isValidPayload(decoded)) {
      return res.status(401).json({
        success: false,
        code: "INVALID_SESSION",
        message:
          "Your session is not valid. Please sign in again.",
      });
    }

    req.user = {
      userId: decoded.userId,
      role: decoded.role,
    };

    return next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      return res.status(401).json({
        success: false,
        code: "SESSION_EXPIRED",
        message:
          "Your session has expired. Please sign in again.",
      });
    }

    if (error instanceof NotBeforeError) {
      return res.status(401).json({
        success: false,
        code: "SESSION_NOT_ACTIVE",
        message:
          "Your session is not active yet. Please sign in again.",
      });
    }

    if (error instanceof JsonWebTokenError) {
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