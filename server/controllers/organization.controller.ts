import { Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthRequest } from "../middleware/auth.middleware";

const prisma = new PrismaClient();

/* =========================================================
   GET CURRENT ORGANIZATION
========================================================= */

export const getCurrentOrganization = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const membership =
      await prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: req.user.userId,
            organizationId: req.user.organizationId,
          },
        },
        include: {
          organization: true,
        },
      });

    if (
      !membership ||
      !membership.isActive ||
      membership.organization.status !== "ACTIVE"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have access to this organization.",
      });
    }

    return res.status(200).json({
      success: true,

      organization: {
        id: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug,
        legalName: membership.organization.legalName,
        registrationNumber:
          membership.organization.registrationNumber,
        taxNumber: membership.organization.taxNumber,
        email: membership.organization.email,
        phoneNumber:
          membership.organization.phoneNumber,
        address: membership.organization.address,
        country: membership.organization.country,
        currency: membership.organization.currency,
        logoUrl: membership.organization.logoUrl,
        status: membership.organization.status,
      },

      membership: {
        role: membership.role,
        isDefault: membership.isDefault,
      },
    });
  } catch (error) {
    console.error(
      "[ORGANIZATION] Fetch error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to retrieve organization.",
    });
  }
};