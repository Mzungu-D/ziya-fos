import { Response } from "express";
import bcrypt from "bcryptjs";

import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

/* =========================================================
   HELPERS
========================================================= */

const normalizeEmail = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase();
};

const normalizeOptionalString = (
  value: unknown
): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();

  return normalized.length > 0
    ? normalized
    : undefined;
};

const normalizeSlug = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

/* =========================================================
   PROVISION ORGANIZATION

   PLATFORM_ADMIN only.

   Creates atomically:
   1. Organization
   2. Initial owner user OR uses existing user
   3. OWNER membership

   No tenant OWNER can access this operation.
========================================================= */

export const provisionOrganization = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const {
      name,
      slug,
      legalName,
      registrationNumber,
      taxNumber,
      email,
      phoneNumber,
      address,
      country,
      currency,
      logoUrl,

      ownerName,
      ownerEmail,
      ownerPhoneNumber,
      ownerPassword,
    } = req.body;

    const organizationName =
      normalizeOptionalString(name);

    const organizationSlug =
      normalizeSlug(slug);

    const normalizedOwnerName =
      normalizeOptionalString(ownerName);

    const normalizedOwnerEmail =
      normalizeEmail(ownerEmail);

    if (!organizationName) {
      return res.status(400).json({
        success: false,
        code: "ORGANIZATION_NAME_REQUIRED",
        message:
          "Organization name is required.",
      });
    }

    if (!organizationSlug) {
      return res.status(400).json({
        success: false,
        code: "ORGANIZATION_SLUG_REQUIRED",
        message:
          "A valid organization slug is required.",
      });
    }

    if (!normalizedOwnerName) {
      return res.status(400).json({
        success: false,
        code: "OWNER_NAME_REQUIRED",
        message:
          "Organization owner name is required.",
      });
    }

    if (!normalizedOwnerEmail) {
      return res.status(400).json({
        success: false,
        code: "OWNER_EMAIL_REQUIRED",
        message:
          "Organization owner email is required.",
      });
    }

    const existingOrganization =
      await prisma.organization.findUnique({
        where: {
          slug: organizationSlug,
        },

        select: {
          id: true,
        },
      });

    if (existingOrganization) {
      return res.status(409).json({
        success: false,
        code: "ORGANIZATION_SLUG_EXISTS",
        message:
          "An organization with this slug already exists.",
      });
    }

    const existingUser =
      await prisma.user.findUnique({
        where: {
          email: normalizedOwnerEmail,
        },

        select: {
          id: true,
          isActive: true,
        },
      });

    /*
     * A password is required only when provisioning
     * a completely new user.
     *
     * Later, email/phone OTP can remove the need for
     * password-based onboarding.
     */
    if (
      !existingUser &&
      (
        typeof ownerPassword !== "string" ||
        ownerPassword.length < 8
      )
    ) {
      return res.status(400).json({
        success: false,
        code: "OWNER_PASSWORD_REQUIRED",
        message:
          "A password of at least 8 characters is required for a new owner.",
      });
    }

    if (
      existingUser &&
      !existingUser.isActive
    ) {
      return res.status(409).json({
        success: false,
        code: "OWNER_ACCOUNT_INACTIVE",
        message:
          "The existing owner account is inactive.",
      });
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const organization =
          await tx.organization.create({
            data: {
              name: organizationName,
              slug: organizationSlug,

              legalName:
                normalizeOptionalString(
                  legalName
                ),

              registrationNumber:
                normalizeOptionalString(
                  registrationNumber
                ),

              taxNumber:
                normalizeOptionalString(
                  taxNumber
                ),

              email:
                normalizeOptionalString(
                  email
                ),

              phoneNumber:
                normalizeOptionalString(
                  phoneNumber
                ),

              address:
                normalizeOptionalString(
                  address
                ),

              country:
                normalizeOptionalString(
                  country
                ) ?? "Kenya",

              currency:
                normalizeOptionalString(
                  currency
                ) ?? "KES",

              logoUrl:
                normalizeOptionalString(
                  logoUrl
                ),

              status: "ACTIVE",
            },
          });

        let owner;

        if (existingUser) {
          owner = await tx.user.findUniqueOrThrow({
            where: {
              id: existingUser.id,
            },
          });
        } else {
          const passwordHash =
            await bcrypt.hash(
              ownerPassword,
              12
            );

          owner = await tx.user.create({
            data: {
              name: normalizedOwnerName,
              email: normalizedOwnerEmail,

              phoneNumber:
                normalizeOptionalString(
                  ownerPhoneNumber
                ),

              password: passwordHash,

              /*
               * Kept for compatibility with the
               * existing User schema.
               *
               * Actual tenant authorization comes
               * from OrganizationMember.role.
               */
              role: "USER",

              platformRole: null,
              isActive: true,
            },
          });
        }

        const existingMembership =
          await tx.organizationMember.findUnique({
            where: {
              userId_organizationId: {
                userId: owner.id,
                organizationId:
                  organization.id,
              },
            },
          });

        if (existingMembership) {
          throw new Error(
            "Organization membership already exists."
          );
        }

        const membership =
          await tx.organizationMember.create({
            data: {
              userId: owner.id,
              organizationId:
                organization.id,

              role: "OWNER",

              /*
               * OWNER receives full tenant access.
               * This wildcard never grants platform
               * administration.
               */
              permissions: ["*"],

              isActive: true,

              /*
               * Existing users may already have a
               * default organization.
               */
              isDefault: existingUser
                ? false
                : true,
            },
          });

        return {
          organization,
          owner,
          membership,
        };
      }
    );

    return res.status(201).json({
      success: true,
      message:
        "Organization provisioned successfully.",

      organization: {
        id: result.organization.id,
        name: result.organization.name,
        slug: result.organization.slug,
        legalName:
          result.organization.legalName,
        registrationNumber:
          result.organization
            .registrationNumber,
        taxNumber:
          result.organization.taxNumber,
        email: result.organization.email,
        phoneNumber:
          result.organization.phoneNumber,
        address:
          result.organization.address,
        country:
          result.organization.country,
        currency:
          result.organization.currency,
        logoUrl:
          result.organization.logoUrl,
        status:
          result.organization.status,
        createdAt:
          result.organization.createdAt,
      },

      owner: {
        id: result.owner.id,
        name: result.owner.name,
        email: result.owner.email,
        phoneNumber:
          result.owner.phoneNumber,
        isActive:
          result.owner.isActive,
      },

      membership: {
        id: result.membership.id,
        role: result.membership.role,
        permissions:
          result.membership.permissions,
        isDefault:
          result.membership.isDefault,
        isActive:
          result.membership.isActive,
      },
    });
  } catch (error) {
    console.error(
      "[PLATFORM] Organization provisioning failed:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "ORGANIZATION_PROVISION_FAILED",
      message:
        "Organization provisioning failed.",
    });
  }
};