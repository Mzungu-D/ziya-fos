import { Request, Response } from "express";
import bcrypt from "bcryptjs";

import prisma from "../config/prisma";

/* =========================================================
   HELPERS
========================================================= */

const normalizeEmail = (
  value: unknown
): string => {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .toLowerCase();
};

const normalizeString = (
  value: unknown
): string => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

const normalizeOptionalString = (
  value: unknown
): string | undefined => {
  const normalized =
    normalizeString(value);

  return normalized.length > 0
    ? normalized
    : undefined;
};

const createSlug = (
  value: string
): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

/* =========================================================
   REGISTER TENANT ORGANIZATION

   POST /api/auth/register

   SELF-SERVICE TENANT ONBOARDING

   Creates atomically:

   1. Organization
   2. Tenant OWNER account
   3. OWNER membership

   IMPORTANT SECURITY MODEL

   - Registration NEVER creates PLATFORM_ADMIN access.
   - Registration NEVER gives access to another tenant.
   - Registration NEVER gives fos@ziya.co.ke tenant access.
   - Every organization receives an isolated workspace.
   - Newly registered organizations start as PENDING.
   - Ziya Platform Admin must approve the organization.
========================================================= */

export const registerOrganization = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      organizationName,
      legalName,
      registrationNumber,
      taxNumber,
      organizationEmail,
      organizationPhoneNumber,
      address,
      country,
      currency,

      ownerName,
      ownerEmail,
      ownerPhoneNumber,
      password,
    } = req.body;

    /* =====================================================
       NORMALIZE INPUT
    ===================================================== */

    const normalizedOrganizationName =
      normalizeString(
        organizationName
      );

    const normalizedOwnerName =
      normalizeString(
        ownerName
      );

    const normalizedOwnerEmail =
      normalizeEmail(
        ownerEmail
      );

    const normalizedOrganizationEmail =
      normalizeEmail(
        organizationEmail
      );

    /* =====================================================
       VALIDATE ORGANIZATION
    ===================================================== */

    if (
      !normalizedOrganizationName
    ) {
      return res.status(400).json({
        success: false,
        code:
          "ORGANIZATION_NAME_REQUIRED",
        message:
          "Organization name is required.",
      });
    }

    /* =====================================================
       VALIDATE OWNER
    ===================================================== */

    if (!normalizedOwnerName) {
      return res.status(400).json({
        success: false,
        code: "OWNER_NAME_REQUIRED",
        message:
          "Your name is required.",
      });
    }

    if (!normalizedOwnerEmail) {
      return res.status(400).json({
        success: false,
        code: "OWNER_EMAIL_REQUIRED",
        message:
          "Email address is required.",
      });
    }

    /* =====================================================
       PASSWORD VALIDATION

       Temporary password onboarding remains in place
       until production OTP onboarding is integrated.
    ===================================================== */

    if (
      typeof password !== "string" ||
      password.length < 8
    ) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PASSWORD",
        message:
          "Password must contain at least 8 characters.",
      });
    }

    /* =====================================================
       CHECK OWNER EMAIL

       Self-service registration creates a completely
       new tenant owner account.

       Existing users can later join additional
       organizations through invitations/memberships.
    ===================================================== */

    const existingUser =
      await prisma.user.findUnique({
        where: {
          email:
            normalizedOwnerEmail,
        },

        select: {
          id: true,
          email: true,
          platformRole: true,
          isActive: true,
        },
      });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        code:
          "EMAIL_ALREADY_REGISTERED",
        message:
          "An account with this email address already exists.",
      });
    }

    /* =====================================================
       PLATFORM ADMIN EMAIL PROTECTION

       This is an additional defensive check.

       Platform authorization is ultimately controlled
       by platformRole, not by email address.
    ===================================================== */

    const platformAccount =
      await prisma.user.findFirst({
        where: {
          email:
            normalizedOwnerEmail,

          platformRole: {
            not: null,
          },
        },

        select: {
          id: true,
        },
      });

    if (platformAccount) {
      return res.status(409).json({
        success: false,
        code:
          "PLATFORM_ACCOUNT_RESERVED",
        message:
          "This email address cannot be used for tenant registration.",
      });
    }

    /* =====================================================
       GENERATE ORGANIZATION SLUG
    ===================================================== */

    const baseSlug =
      createSlug(
        normalizedOrganizationName
      );

    if (!baseSlug) {
      return res.status(400).json({
        success: false,
        code:
          "INVALID_ORGANIZATION_NAME",
        message:
          "Organization name could not be used to create a workspace.",
      });
    }

    let organizationSlug =
      baseSlug;

    let suffix = 1;

    /*
     * Generate a unique workspace slug.
     *
     * Example:
     *
     * acme
     * acme-2
     * acme-3
     */
    while (
      await prisma.organization.findUnique({
        where: {
          slug:
            organizationSlug,
        },

        select: {
          id: true,
        },
      })
    ) {
      suffix += 1;

      organizationSlug =
        `${baseSlug}-${suffix}`;
    }

    /* =====================================================
       HASH PASSWORD
    ===================================================== */

    const passwordHash =
      await bcrypt.hash(
        password,
        12
      );

    /* =====================================================
       CREATE TENANT ATOMICALLY

       If any operation fails, Prisma rolls back the
       complete registration.
    ===================================================== */

    const result =
      await prisma.$transaction(
        async (tx) => {
          /* ===============================================
             CREATE ORGANIZATION

             IMPORTANT:

             PENDING organizations cannot enter the FOS
             workspace until Ziya approves them.
          =============================================== */

          const organization =
            await tx.organization.create({
              data: {
                name:
                  normalizedOrganizationName,

                slug:
                  organizationSlug,

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
                  normalizedOrganizationEmail ||
                  undefined,

                phoneNumber:
                  normalizeOptionalString(
                    organizationPhoneNumber
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

                /*
                 * Self-service organizations require
                 * platform approval.
                 */
                status: "PENDING",
              },
            });

          /* ===============================================
             CREATE TENANT OWNER

             Tenant owner is completely separate from
             the Ziya FOS platform administrator.
          =============================================== */

          const owner =
            await tx.user.create({
              data: {
                name:
                  normalizedOwnerName,

                email:
                  normalizedOwnerEmail,

                phoneNumber:
                  normalizeOptionalString(
                    ownerPhoneNumber
                  ),

                password:
                  passwordHash,

                /*
                 * Legacy compatibility field only.
                 *
                 * Tenant authority comes from
                 * OrganizationMember.role.
                 */
                role: "USER",

                /*
                 * CRITICAL:
                 *
                 * Tenant users never receive platform
                 * administration privileges.
                 */
                platformRole: null,

                isActive: true,
              },
            });

          /* ===============================================
             CREATE OWNER MEMBERSHIP

             OWNER receives full permissions only inside
             this organization.
          =============================================== */

          const membership =
            await tx.organizationMember.create({
              data: {
                userId:
                  owner.id,

                organizationId:
                  organization.id,

                role: "OWNER",

                permissions: [
                  "*",
                ],

                isActive: true,

                /*
                 * This is the first organization
                 * belonging to this new account.
                 */
                isDefault: true,
              },
            });

          return {
            organization,
            owner,
            membership,
          };
        }
      );

    /* =====================================================
       SUCCESS RESPONSE

       IMPORTANT:

       No JWT is issued here.

       Organization remains PENDING.

       After Ziya approves the organization, the owner
       can authenticate through the normal login/OTP flow.
    ===================================================== */

    return res.status(201).json({
      success: true,

      code:
        "REGISTRATION_PENDING_APPROVAL",

      message:
        "Registration submitted successfully. Your organization is awaiting approval.",

      organization: {
        id:
          result.organization.id,

        name:
          result.organization.name,

        slug:
          result.organization.slug,

        legalName:
          result.organization
            .legalName,

        registrationNumber:
          result.organization
            .registrationNumber,

        email:
          result.organization.email,

        phoneNumber:
          result.organization
            .phoneNumber,

        country:
          result.organization.country,

        currency:
          result.organization.currency,

        status:
          result.organization.status,

        createdAt:
          result.organization.createdAt,
      },

      owner: {
        id:
          result.owner.id,

        name:
          result.owner.name,

        email:
          result.owner.email,

        phoneNumber:
          result.owner.phoneNumber,

        isActive:
          result.owner.isActive,
      },

      membership: {
        id:
          result.membership.id,

        role:
          result.membership.role,

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
      "[REGISTRATION] Organization registration failed:",
      error
    );

    return res.status(500).json({
      success: false,
      code:
        "REGISTRATION_FAILED",
      message:
        "Organization registration could not be completed.",
    });
  }
};