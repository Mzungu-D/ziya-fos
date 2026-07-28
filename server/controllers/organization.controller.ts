import { Response } from "express";
import jwt from "jsonwebtoken";

import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

/* =========================================================
   JWT
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
   REQUIRE TENANT SESSION
========================================================= */

function getTenantContext(
  req: AuthRequest
): {
  userId: string;
  organizationId: string;
} | null {
  if (
    !req.user ||
    req.user.sessionType !== "TENANT" ||
    !req.user.organizationId
  ) {
    return null;
  }

  return {
    userId: req.user.userId,
    organizationId:
      req.user.organizationId,
  };
}

/* =========================================================
   GET USER ORGANIZATIONS
========================================================= */

export const getOrganizations = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        code: "AUTH_REQUIRED",
        message: "Authentication required.",
      });
    }

    /*
     * Platform administrators do not automatically
     * receive access to tenant organizations.
     */
    if (req.user.sessionType !== "TENANT") {
      return res.status(403).json({
        success: false,
        code: "TENANT_SESSION_REQUIRED",
        message:
          "A tenant session is required to access organizations.",
      });
    }

    const memberships =
      await prisma.organizationMember.findMany({
        where: {
          userId: req.user.userId,
          isActive: true,

          organization: {
            status: "ACTIVE",
          },
        },

        select: {
          id: true,
          role: true,
          permissions: true,
          isDefault: true,
          joinedAt: true,

          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              legalName: true,
              registrationNumber: true,
              taxNumber: true,
              email: true,
              phoneNumber: true,
              address: true,
              country: true,
              currency: true,
              logoUrl: true,
              status: true,
            },
          },
        },

        orderBy: [
          {
            isDefault: "desc",
          },
          {
            joinedAt: "asc",
          },
        ],
      });

    return res.status(200).json({
      success: true,

      organizations: memberships.map(
        (membership) => ({
          ...membership.organization,

          membership: {
            role: membership.role,
            permissions:
              membership.permissions,
            isDefault:
              membership.isDefault,
          },
        })
      ),
    });
  } catch (error) {
    console.error(
      "[ORGANIZATION] List error:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "ORGANIZATION_LIST_FAILED",
      message:
        "Unable to retrieve organizations.",
    });
  }
};

/* =========================================================
   GET CURRENT ORGANIZATION
========================================================= */

export const getCurrentOrganization = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const context =
      getTenantContext(req);

    if (!context) {
      return res.status(403).json({
        success: false,
        code: "TENANT_SESSION_REQUIRED",
        message:
          "A tenant session is required.",
      });
    }

    const membership =
      await prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: context.userId,
            organizationId:
              context.organizationId,
          },
        },

        select: {
          role: true,
          permissions: true,
          isActive: true,
          isDefault: true,

          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              legalName: true,
              registrationNumber: true,
              taxNumber: true,
              email: true,
              phoneNumber: true,
              address: true,
              country: true,
              currency: true,
              logoUrl: true,
              status: true,
            },
          },
        },
      });

    if (
      !membership ||
      !membership.isActive ||
      membership.organization.status !==
        "ACTIVE"
    ) {
      return res.status(403).json({
        success: false,
        code: "ORGANIZATION_ACCESS_DENIED",
        message:
          "You do not have access to this organization.",
      });
    }

    return res.status(200).json({
      success: true,

      organization:
        membership.organization,

      membership: {
        role: membership.role,
        permissions:
          membership.permissions,
        isDefault:
          membership.isDefault,
      },
    });
  } catch (error) {
    console.error(
      "[ORGANIZATION] Fetch error:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "ORGANIZATION_FETCH_FAILED",
      message:
        "Unable to retrieve organization.",
    });
  }
};

/* =========================================================
   SWITCH ORGANIZATION
========================================================= */

export const switchOrganization = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (
      !req.user ||
      req.user.sessionType !== "TENANT"
    ) {
      return res.status(403).json({
        success: false,
        code: "TENANT_SESSION_REQUIRED",
        message:
          "A tenant session is required.",
      });
    }

    const organizationId =
      typeof req.body?.organizationId ===
      "string"
        ? req.body.organizationId.trim()
        : "";

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        code: "ORGANIZATION_REQUIRED",
        message:
          "Organization ID is required.",
      });
    }

    /*
     * Membership is the authority for switching.
     *
     * Platform role never grants membership.
     */
    const membership =
      await prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: req.user.userId,
            organizationId,
          },
        },

        select: {
          role: true,
          isActive: true,

          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
              country: true,
              currency: true,
              status: true,
            },
          },
        },
      });

    if (
      !membership ||
      !membership.isActive ||
      membership.organization.status !==
        "ACTIVE"
    ) {
      return res.status(403).json({
        success: false,
        code: "ORGANIZATION_ACCESS_DENIED",
        message:
          "You do not have access to the selected organization.",
      });
    }

    /*
     * Issue a NEW tenant token.
     *
     * We never modify the organizationId from
     * arbitrary request data without first proving
     * membership.
     */
    const token = jwt.sign(
      {
        userId: req.user.userId,
        sessionType: "TENANT",
        organizationId:
          membership.organization.id,
        role: membership.role,
      },
      getJwtSecret(),
      {
        expiresIn: "1d",
      }
    );

    return res.status(200).json({
      success: true,
      message:
        "Organization switched successfully.",

      token,

      organization: {
        id: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug,
        logoUrl:
          membership.organization.logoUrl,
        country:
          membership.organization.country,
        currency:
          membership.organization.currency,
      },

      membership: {
        role: membership.role,
      },
    });
  } catch (error) {
    console.error(
      "[ORGANIZATION] Switch error:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "ORGANIZATION_SWITCH_FAILED",
      message:
        "Unable to switch organization.",
    });
  }
};