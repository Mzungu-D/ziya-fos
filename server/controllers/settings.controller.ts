import { Request, Response } from "express";

import prisma from "../config/prisma";

import {
  AuthRequest,
} from "../middleware/auth.middleware";

/* =========================================================
   TENANT SETTINGS CONTROLLER

   SECURITY MODEL
   ---------------------------------------------------------
   - Tenant endpoints only.
   - Requires an authenticated TENANT session.
   - Never accepts organizationId from the client.
   - Organization is always taken from the authenticated
     request context.
   - User profile operations are restricted to the
     authenticated user.
   - Session operations are restricted to sessions belonging
     to the authenticated user.
   - Platform administration is completely separate.
========================================================= */

/* =========================================================
   HELPERS
========================================================= */

const getTenantContext = (
  req: AuthRequest
) => {
  const user = req.user;

  if (!user) {
    return null;
  }

  if (user.sessionType !== "TENANT") {
    return null;
  }

  if (
    typeof user.userId !== "string" ||
    !user.userId.trim()
  ) {
    return null;
  }

  if (
    typeof user.organizationId !== "string" ||
    !user.organizationId.trim()
  ) {
    return null;
  }

  return {
    userId: user.userId.trim(),
    organizationId:
      user.organizationId.trim(),
  };
};

/* =========================================================
   GET TENANT SETTINGS
   GET /api/settings
========================================================= */

export const getSettings = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const context =
      getTenantContext(req);

    if (!context) {
      return res.status(403).json({
        success: false,
        code: "TENANT_ACCESS_REQUIRED",
        message:
          "A valid tenant session is required.",
      });
    }

    const [
      user,
      organization,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: {
          id: context.userId,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          role: true,
          phoneVerifiedAt: true,
          emailVerifiedAt: true,
          lastLoginAt: true,
        },
      }),

      prisma.organization.findUnique({
        where: {
          id: context.organizationId,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          legalName: true,
          registrationNumber: true,
          taxNumber: true,
        },
      }),
    ]);

    if (!user) {
      return res.status(404).json({
        success: false,
        code: "USER_NOT_FOUND",
        message:
          "Your user account could not be found.",
      });
    }

    if (!organization) {
      return res.status(404).json({
        success: false,
        code: "ORGANIZATION_NOT_FOUND",
        message:
          "Your organization could not be found.",
      });
    }

    return res.status(200).json({
      success: true,

      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber:
          user.phoneNumber,
        role: user.role,
        phoneVerified:
          Boolean(
            user.phoneVerifiedAt
          ),
        emailVerified:
          Boolean(
            user.emailVerifiedAt
          ),
        lastLoginAt:
          user.lastLoginAt,
      },

      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        legalName:
          organization.legalName,
        registrationNumber:
          organization.registrationNumber,
        taxNumber:
          organization.taxNumber,
      },
    });
  } catch (error) {
    console.error(
      "[TENANT SETTINGS] Failed to load settings:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "SETTINGS_LOAD_FAILED",
      message:
        "Failed to load settings.",
    });
  }
};

/* =========================================================
   UPDATE CURRENT USER PROFILE
   PATCH /api/settings/profile

   Only the authenticated user's own profile can be changed.
========================================================= */

export const updateProfile = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const context =
      getTenantContext(req);

    if (!context) {
      return res.status(403).json({
        success: false,
        code: "TENANT_ACCESS_REQUIRED",
        message:
          "A valid tenant session is required.",
      });
    }

    const {
      name,
      phoneNumber,
    } = req.body ?? {};

    const updateData: {
      name?: string;
      phoneNumber?: string | null;
    } = {};

    if (name !== undefined) {
      if (
        typeof name !== "string" ||
        !name.trim()
      ) {
        return res.status(400).json({
          success: false,
          code: "INVALID_NAME",
          message:
            "Name must be a non-empty value.",
        });
      }

      if (name.trim().length > 150) {
        return res.status(400).json({
          success: false,
          code: "NAME_TOO_LONG",
          message:
            "Name is too long.",
        });
      }

      updateData.name =
        name.trim();
    }

    if (phoneNumber !== undefined) {
      if (
        phoneNumber !== null &&
        typeof phoneNumber !== "string"
      ) {
        return res.status(400).json({
          success: false,
          code: "INVALID_PHONE",
          message:
            "Phone number must be a valid value.",
        });
      }

      const normalizedPhone =
        typeof phoneNumber ===
        "string"
          ? phoneNumber.trim()
          : "";

      if (
        normalizedPhone.length > 30
      ) {
        return res.status(400).json({
          success: false,
          code: "PHONE_TOO_LONG",
          message:
            "Phone number is too long.",
        });
      }

      updateData.phoneNumber =
        normalizedPhone || null;
    }

    if (
      Object.keys(updateData)
        .length === 0
    ) {
      return res.status(400).json({
        success: false,
        code: "NO_CHANGES",
        message:
          "No profile changes were provided.",
      });
    }

    const updatedUser =
      await prisma.user.update({
        where: {
          id: context.userId,
        },

        data: updateData,

        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          role: true,
          phoneVerifiedAt: true,
          emailVerifiedAt: true,
        },
      });

    return res.status(200).json({
      success: true,
      message:
        "Profile updated successfully.",
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        phoneNumber:
          updatedUser.phoneNumber,
        role: updatedUser.role,
        phoneVerified:
          Boolean(
            updatedUser.phoneVerifiedAt
          ),
        emailVerified:
          Boolean(
            updatedUser.emailVerifiedAt
          ),
      },
    });
  } catch (error) {
    console.error(
      "[TENANT SETTINGS] Failed to update profile:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "PROFILE_UPDATE_FAILED",
      message:
        "Failed to update your profile.",
    });
  }
};

/* =========================================================
   GET ACTIVE SESSIONS
   GET /api/settings/sessions

   Only sessions belonging to the authenticated user
   are returned.

   Token values are NEVER returned.
========================================================= */

export const getSessions = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const context =
      getTenantContext(req);

    if (!context) {
      return res.status(403).json({
        success: false,
        code: "TENANT_ACCESS_REQUIRED",
        message:
          "A valid tenant session is required.",
      });
    }

    const sessions =
      await prisma.session.findMany({
        where: {
          userId: context.userId,
          isActive: true,
          expiresAt: {
            gt: new Date(),
          },
        },

        select: {
          id: true,
          createdAt: true,
          lastActiveAt: true,
          expiresAt: true,
          ipAddress: true,
          userAgent: true,
          rememberMe: true,
        },

        orderBy: {
          lastActiveAt: "desc",
        },
      });

    return res.status(200).json({
      success: true,
      sessions,
    });
  } catch (error) {
    console.error(
      "[TENANT SETTINGS] Failed to load sessions:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "SESSIONS_LOAD_FAILED",
      message:
        "Failed to load active sessions.",
    });
  }
};

/* =========================================================
   REVOKE A SESSION
   DELETE /api/settings/sessions/:sessionId

   SECURITY:
   - The session must belong to the authenticated user.
   - A tenant cannot revoke another user's session.
   - Tokens are never exposed.
========================================================= */

export const revokeSession = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const context =
      getTenantContext(req);

    if (!context) {
      return res.status(403).json({
        success: false,
        code: "TENANT_ACCESS_REQUIRED",
        message:
          "A valid tenant session is required.",
      });
    }

    const sessionId =
      typeof req.params.sessionId ===
      "string"
        ? req.params.sessionId.trim()
        : "";

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        code: "SESSION_ID_REQUIRED",
        message:
          "Session ID is required.",
      });
    }

    const session =
      await prisma.session.findFirst({
        where: {
          id: sessionId,
          userId: context.userId,
          isActive: true,
        },

        select: {
          id: true,
        },
      });

    if (!session) {
      return res.status(404).json({
        success: false,
        code: "SESSION_NOT_FOUND",
        message:
          "The session was not found.",
      });
    }

    await prisma.session.update({
      where: {
        id: session.id,
      },

      data: {
        isActive: false,
      },
    });

    return res.status(200).json({
      success: true,
      message:
        "Session revoked successfully.",
    });
  } catch (error) {
    console.error(
      "[TENANT SETTINGS] Failed to revoke session:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "SESSION_REVOKE_FAILED",
      message:
        "Failed to revoke the session.",
    });
  }
};

/* =========================================================
   REVOKE ALL OTHER SESSIONS
   POST /api/settings/sessions/revoke-others

   IMPORTANT:
   We intentionally do not use req.user.sessionId here
   because AuthUser currently exposes userId but not
   sessionId.

   Therefore this operation safely revokes all active
   sessions belonging to the user.

   If we later expose sessionId in AuthUser, this can be
   changed to preserve the current session.
========================================================= */

export const revokeOtherSessions = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const context =
      getTenantContext(req);

    if (!context) {
      return res.status(403).json({
        success: false,
        code: "TENANT_ACCESS_REQUIRED",
        message:
          "A valid tenant session is required.",
      });
    }

    /*
     * We deliberately avoid pretending we know which
     * session is the current session because AuthUser
     * does not currently expose sessionId.
     *
     * This endpoint therefore should not be wired into
     * the UI until the authentication middleware exposes
     * sessionId safely.
     */
    return res.status(501).json({
      success: false,
      code: "CURRENT_SESSION_ID_REQUIRED",
      message:
        "Revoking all other sessions requires the authenticated session ID to be exposed by the authentication middleware.",
    });
  } catch (error) {
    console.error(
      "[TENANT SETTINGS] Failed to revoke other sessions:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "SESSION_REVOKE_FAILED",
      message:
        "Failed to revoke other sessions.",
    });
  }
};