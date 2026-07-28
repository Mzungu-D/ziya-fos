import {
  Response,
  NextFunction,
} from "express";

import prisma from "../config/prisma";
import { AuthRequest } from "./auth.middleware";

/* =========================================================
   ZIYA PLATFORM ADMIN AUTHORIZATION

   SECURITY BOUNDARY

   PLATFORM_ADMIN:
   - Manages the Ziya FOS platform.
   - Can provision organizations.
   - Can perform platform-level administration.

   PLATFORM_ADMIN does NOT:
   - Receive tenant membership automatically.
   - Receive access to tenant financial records.
   - Become a tenant OWNER.
   - Bypass tenant RBAC.

   TENANT OWNER / "*":
   - Cannot access platform administration.

   Legacy User.role values such as SUPER_ADMIN
   are NOT platform authorization.
========================================================= */

export const requirePlatformAdmin = async (
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
       PLATFORM SESSION REQUIRED

       A TENANT session is rejected even if:
       - membership.role === OWNER
       - permissions contains "*"
       - legacy User.role === SUPER_ADMIN
    ===================================================== */

    if (
      req.user.sessionType !== "PLATFORM"
    ) {
      return res.status(403).json({
        success: false,
        code:
          "PLATFORM_SESSION_REQUIRED",
        message:
          "Platform administrator access is required.",
      });
    }

    if (
      !req.user.userId ||
      req.user.platformRole !==
        "PLATFORM_ADMIN"
    ) {
      return res.status(403).json({
        success: false,
        code:
          "PLATFORM_ADMIN_REQUIRED",
        message:
          "Platform administrator access is required.",
      });
    }

    /* =====================================================
       DATABASE IS SOURCE OF TRUTH

       Never authorize platform access from the JWT alone.

       This means removing platformRole from the user
       revokes platform access immediately.
    ===================================================== */

    const user =
      await prisma.user.findUnique({
        where: {
          id: req.user.userId,
        },

        select: {
          id: true,
          email: true,
          isActive: true,
          platformRole: true,
        },
      });

    if (!user) {
      return res.status(401).json({
        success: false,
        code: "ACCOUNT_NOT_FOUND",
        message:
          "Authenticated account was not found.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_DISABLED",
        message:
          "This account is disabled.",
      });
    }

    if (
      user.platformRole !==
      "PLATFORM_ADMIN"
    ) {
      return res.status(403).json({
        success: false,
        code:
          "PLATFORM_ACCESS_REVOKED",
        message:
          "Platform administrator access is no longer available.",
      });
    }

    /* =====================================================
       IMPORTANT

       We deliberately do NOT:
       - query OrganizationMember
       - attach organizationId
       - attach tenant role
       - attach tenant permissions

       Platform identity remains outside tenant finance.
    ===================================================== */

    return next();
  } catch (error) {
    console.error(
      "[PLATFORM ADMIN] Authorization failed:",
      error
    );

    return res.status(500).json({
      success: false,
      code:
        "PLATFORM_AUTHORIZATION_FAILED",
      message:
        "Platform authorization could not be completed.",
    });
  }
};