import {
  Request,
  Response,
  NextFunction,
} from "express";
import jwt from "jsonwebtoken";

export interface AuthUser {
  userId: string;
  role: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();

  if (!secret) {
    throw new Error(
      "JWT_SECRET is not configured."
    );
  }

  return secret;
}

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

  return token || null;
}

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

  const secret = process.env.JWT_SECRET?.trim();

  if (!secret) {
    console.error(
      "[AUTH] JWT_SECRET is not configured."
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
      getJwtSecret()
    );

    if (
      typeof decoded === "string" ||
      !decoded ||
      typeof decoded.userId !== "string" ||
      typeof decoded.role !== "string"
    ) {
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
    const jwtError =
      error instanceof Error
        ? error
        : new Error("Authentication failed");

    if (jwtError.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        code: "SESSION_EXPIRED",
        message:
          "Your session has expired. Please sign in again.",
      });
    }

    if (jwtError.name === "NotBeforeError") {
      return res.status(401).json({
        success: false,
        code: "SESSION_NOT_ACTIVE",
        message:
          "Your session is not active yet. Please sign in again.",
      });
    }

    if (jwtError.name === "JsonWebTokenError") {
      console.warn(
        "[AUTH] JWT verification failed:",
        jwtError.message
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
      jwtError
    );

    return res.status(500).json({
      success: false,
      code: "AUTH_ERROR",
      message:
        "Authentication could not be completed.",
    });
  }
};