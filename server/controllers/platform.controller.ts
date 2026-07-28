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
   REQUEST IP
========================================================= */

const getRequestIp = (
  req: AuthRequest
): string | undefined => {
  const forwardedFor =
    req.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string") {
    const firstIp =
      forwardedFor
        .split(",")[0]
        ?.trim();

    if (firstIp) {
      return firstIp;
    }
  }

  if (Array.isArray(forwardedFor)) {
    const firstIp =
      forwardedFor[0]
        ?.split(",")[0]
        ?.trim();

    if (firstIp) {
      return firstIp;
    }
  }

  return (
    req.ip ||
    req.socket.remoteAddress ||
    undefined
  );
};

/* =========================================================
   PLATFORM AUDIT LOG

   Administrative metadata only.

   NEVER stores tenant financial records.
========================================================= */

const createPlatformAuditLog = async ({
  req,
  action,
  resource,
  resourceId,
  details,
}: {
  req: AuthRequest;
  action: string;
  resource: string;
  resourceId?: string;
  details?: string;
}) => {
  if (
    !req.user ||
    req.user.sessionType !== "PLATFORM"
  ) {
    throw new Error(
      "Platform audit logging requires a platform session."
    );
  }

  const actor =
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

  if (
    !actor ||
    !actor.isActive ||
    actor.platformRole !== "PLATFORM_ADMIN"
  ) {
    throw new Error(
      "Authenticated platform administrator could not be verified."
    );
  }

  await prisma.platformAuditLog.create({
    data: {
      actorUserId:
        actor.id,

      actorEmail:
        actor.email,

      action,

      resource,

      resourceId:
        resourceId ?? null,

      details:
        details ?? null,

      ipAddress:
        getRequestIp(req) ?? null,

      userAgent:
        req.get("user-agent") ?? null,
    },
  });
};

/* =========================================================
   PROVISION ORGANIZATION

   POST /api/platform/organizations

   PLATFORM_ADMIN only.

   Creates:
   1. Organization
   2. Initial OWNER
   3. OWNER membership

   Platform administrators never receive tenant membership.
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

    /* =====================================================
       VALIDATION
    ===================================================== */

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

    /* =====================================================
       CHECK ORGANIZATION
    ===================================================== */

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

    /* =====================================================
       CHECK OWNER
    ===================================================== */

    const existingUser =
      await prisma.user.findUnique({
        where: {
          email:
            normalizedOwnerEmail,
        },

        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          platformRole: true,
        },
      });

    /*
     * Platform identities cannot become tenant members.
     */
    if (existingUser?.platformRole) {
      return res.status(409).json({
        success: false,
        code:
          "PLATFORM_ACCOUNT_CANNOT_OWN_TENANT",
        message:
          "A platform administration account cannot own a tenant organization.",
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

    /*
     * Password onboarding remains until production
     * OTP integration is completed.
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

    /* =====================================================
       TRANSACTION
    ===================================================== */

    const result =
      await prisma.$transaction(
        async (tx) => {
          const organization =
            await tx.organization.create({
              data: {
                name:
                  organizationName,

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

                /*
                 * Platform-controlled provisioning
                 * is immediately active.
                 */
                status: "ACTIVE",
              },
            });

          let owner;

          if (existingUser) {
            owner =
              await tx.user.findUniqueOrThrow({
                where: {
                  id:
                    existingUser.id,
                },
              });
          } else {
            const passwordHash =
              await bcrypt.hash(
                ownerPassword,
                12
              );

            owner =
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

                  role: "USER",

                  /*
                   * Tenant users never receive
                   * platform privileges.
                   */
                  platformRole: null,

                  isActive: true,
                },
              });
          }

          /* ===============================================
             DETERMINE DEFAULT WORKSPACE
          =============================================== */

          const existingMembershipCount =
            await tx.organizationMember.count({
              where: {
                userId:
                  owner.id,
              },
            });

          /* ===============================================
             CREATE OWNER MEMBERSHIP
          =============================================== */

          const membership =
            await tx.organizationMember.create({
              data: {
                userId:
                  owner.id,

                organizationId:
                  organization.id,

                role: "OWNER",

                permissions: ["*"],

                isActive: true,

                isDefault:
                  existingMembershipCount === 0,
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
       AUDIT
    ===================================================== */

    await createPlatformAuditLog({
      req,

      action:
        "ORGANIZATION_PROVISIONED",

      resource:
        "ORGANIZATION",

      resourceId:
        result.organization.id,

      details:
        JSON.stringify({
          organizationName:
            result.organization.name,

          organizationSlug:
            result.organization.slug,

          ownerUserId:
            result.owner.id,

          ownerEmail:
            result.owner.email,
        }),
    });

    /* =====================================================
       RESPONSE
    ===================================================== */

    return res.status(201).json({
      success: true,

      message:
        "Organization provisioned successfully.",

      organization: {
        id:
          result.organization.id,

        name:
          result.organization.name,

        slug:
          result.organization.slug,

        legalName:
          result.organization.legalName,

        registrationNumber:
          result.organization
            .registrationNumber,

        taxNumber:
          result.organization.taxNumber,

        email:
          result.organization.email,

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
      "[PLATFORM] Organization provisioning failed:",
      error
    );

    return res.status(500).json({
      success: false,
      code:
        "ORGANIZATION_PROVISION_FAILED",
      message:
        "Organization provisioning failed.",
    });
  }
};

/* =========================================================
   LIST TENANT ORGANIZATIONS

   GET /api/platform/organizations

   Optional:

   ?status=PENDING
   ?status=ACTIVE
   ?status=SUSPENDED

   Administrative metadata only.
========================================================= */

export const getPlatformOrganizations =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      /* ===================================================
         STATUS FILTER
      =================================================== */

      const rawStatus =
        typeof req.query.status === "string"
          ? req.query.status
              .trim()
              .toUpperCase()
          : "";

      const allowedStatuses = [
        "PENDING",
        "ACTIVE",
        "SUSPENDED",
      ] as const;

      type AllowedStatus =
        (typeof allowedStatuses)[number];

      let status:
        | AllowedStatus
        | undefined;

      if (rawStatus) {
        if (
          !allowedStatuses.includes(
            rawStatus as AllowedStatus
          )
        ) {
          return res.status(400).json({
            success: false,
            code:
              "INVALID_ORGANIZATION_STATUS",
            message:
              "Organization status must be PENDING, ACTIVE, or SUSPENDED.",
          });
        }

        status =
          rawStatus as AllowedStatus;
      }

      /* ===================================================
         FETCH ADMINISTRATIVE METADATA ONLY
      =================================================== */

      const organizations =
        await prisma.organization.findMany({
          where: status
            ? {
                status,
              }
            : undefined,

          select: {
            id: true,
            name: true,
            slug: true,
            legalName: true,
            registrationNumber: true,
            email: true,
            phoneNumber: true,
            country: true,
            currency: true,
            logoUrl: true,
            status: true,
            createdAt: true,
            updatedAt: true,

            _count: {
              select: {
                memberships: true,
              },
            },
          },

          orderBy: {
            createdAt: "desc",
          },
        });

      return res.status(200).json({
        success: true,

        filter: {
          status:
            status ?? null,
        },

        count:
          organizations.length,

        organizations:
          organizations.map(
            (organization) => ({
              id:
                organization.id,

              name:
                organization.name,

              slug:
                organization.slug,

              legalName:
                organization.legalName,

              registrationNumber:
                organization
                  .registrationNumber,

              email:
                organization.email,

              phoneNumber:
                organization.phoneNumber,

              country:
                organization.country,

              currency:
                organization.currency,

              logoUrl:
                organization.logoUrl,

              status:
                organization.status,

              memberCount:
                organization
                  ._count
                  .memberships,

              createdAt:
                organization.createdAt,

              updatedAt:
                organization.updatedAt,
            })
          ),
      });
    } catch (error) {
      console.error(
        "[PLATFORM] Organization list failed:",
        error
      );

      return res.status(500).json({
        success: false,
        code:
          "PLATFORM_ORGANIZATION_LIST_FAILED",
        message:
          "Unable to retrieve organizations.",
      });
    }
  };

/* =========================================================
   GET TENANT ADMINISTRATIVE DETAILS

   GET /api/platform/organizations/:organizationId

   Administrative metadata and membership information only.
   No tenant financial records.
========================================================= */

export const getPlatformOrganization =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const organizationId =
        typeof req.params.organizationId ===
        "string"
          ? req.params.organizationId.trim()
          : "";

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          code:
            "ORGANIZATION_REQUIRED",
          message:
            "Organization ID is required.",
        });
      }

      const organization =
        await prisma.organization.findUnique({
          where: {
            id:
              organizationId,
          },

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
            createdAt: true,
            updatedAt: true,

            memberships: {
              select: {
                id: true,
                role: true,
                isActive: true,
                isDefault: true,
                joinedAt: true,

                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    phoneNumber: true,
                    isActive: true,
                  },
                },
              },

              orderBy: {
                joinedAt: "asc",
              },
            },
          },
        });

      if (!organization) {
        return res.status(404).json({
          success: false,
          code:
            "ORGANIZATION_NOT_FOUND",
          message:
            "Organization was not found.",
        });
      }

      return res.status(200).json({
        success: true,

        organization: {
          id:
            organization.id,

          name:
            organization.name,

          slug:
            organization.slug,

          legalName:
            organization.legalName,

          registrationNumber:
            organization.registrationNumber,

          taxNumber:
            organization.taxNumber,

          email:
            organization.email,

          phoneNumber:
            organization.phoneNumber,

          address:
            organization.address,

          country:
            organization.country,

          currency:
            organization.currency,

          logoUrl:
            organization.logoUrl,

          status:
            organization.status,

          createdAt:
            organization.createdAt,

          updatedAt:
            organization.updatedAt,

          members:
            organization.memberships.map(
              (membership) => ({
                membershipId:
                  membership.id,

                role:
                  membership.role,

                isActive:
                  membership.isActive,

                isDefault:
                  membership.isDefault,

                joinedAt:
                  membership.joinedAt,

                user: {
                  id:
                    membership.user.id,

                  name:
                    membership.user.name,

                  email:
                    membership.user.email,

                  phoneNumber:
                    membership.user
                      .phoneNumber,

                  isActive:
                    membership.user
                      .isActive,
                },
              })
            ),
        },
      });
    } catch (error) {
      console.error(
        "[PLATFORM] Organization fetch failed:",
        error
      );

      return res.status(500).json({
        success: false,
        code:
          "PLATFORM_ORGANIZATION_FETCH_FAILED",
        message:
          "Unable to retrieve organization.",
      });
    }
  };

/* =========================================================
   APPROVE ORGANIZATION

   PATCH /api/platform/organizations/:organizationId/approve

   PENDING -> ACTIVE
========================================================= */

export const approveOrganization =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const organizationId =
        typeof req.params.organizationId ===
        "string"
          ? req.params.organizationId.trim()
          : "";

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          code:
            "ORGANIZATION_REQUIRED",
          message:
            "Organization ID is required.",
        });
      }

      const organization =
        await prisma.organization.findUnique({
          where: {
            id:
              organizationId,
          },

          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
          },
        });

      if (!organization) {
        return res.status(404).json({
          success: false,
          code:
            "ORGANIZATION_NOT_FOUND",
          message:
            "Organization was not found.",
        });
      }

      if (
        organization.status ===
        "ACTIVE"
      ) {
        return res.status(409).json({
          success: false,
          code:
            "ORGANIZATION_ALREADY_APPROVED",
          message:
            "This organization has already been approved.",
        });
      }

      /*
       * Suspended organizations cannot bypass the
       * reactivation lifecycle through /approve.
       */
      if (
        organization.status !==
        "PENDING"
      ) {
        return res.status(409).json({
          success: false,
          code:
            "INVALID_APPROVAL_STATE",
          message:
            "Only pending organizations can be approved.",
        });
      }

      const updated =
        await prisma.organization.update({
          where: {
            id:
              organizationId,
          },

          data: {
            status:
              "ACTIVE",
          },

          select: {
            id: true,
            name: true,
            slug: true,
            legalName: true,
            registrationNumber: true,
            email: true,
            phoneNumber: true,
            country: true,
            currency: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        });

      await createPlatformAuditLog({
        req,

        action:
          "ORGANIZATION_APPROVED",

        resource:
          "ORGANIZATION",

        resourceId:
          updated.id,

        details:
          JSON.stringify({
            organizationName:
              updated.name,

            organizationSlug:
              updated.slug,

            previousStatus:
              organization.status,

            newStatus:
              updated.status,
          }),
      });

      return res.status(200).json({
        success: true,

        message:
          "Organization approved successfully.",

        organization:
          updated,
      });
    } catch (error) {
      console.error(
        "[PLATFORM] Organization approval failed:",
        error
      );

      return res.status(500).json({
        success: false,
        code:
          "ORGANIZATION_APPROVAL_FAILED",
        message:
          "Unable to approve organization.",
      });
    }
  };

/* =========================================================
   SUSPEND ORGANIZATION

   PATCH /api/platform/organizations/:organizationId/suspend

   ACTIVE -> SUSPENDED
========================================================= */

export const suspendOrganization =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const organizationId =
        typeof req.params.organizationId ===
        "string"
          ? req.params.organizationId.trim()
          : "";

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          code:
            "ORGANIZATION_REQUIRED",
          message:
            "Organization ID is required.",
        });
      }

      const organization =
        await prisma.organization.findUnique({
          where: {
            id:
              organizationId,
          },

          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
          },
        });

      if (!organization) {
        return res.status(404).json({
          success: false,
          code:
            "ORGANIZATION_NOT_FOUND",
          message:
            "Organization was not found.",
        });
      }

      if (
        organization.status ===
        "PENDING"
      ) {
        return res.status(409).json({
          success: false,
          code:
            "ORGANIZATION_NOT_APPROVED",
          message:
            "A pending organization cannot be suspended.",
        });
      }

      if (
        organization.status ===
        "SUSPENDED"
      ) {
        return res.status(200).json({
          success: true,

          message:
            "Organization is already suspended.",

          organization,
        });
      }

      if (
        organization.status !==
        "ACTIVE"
      ) {
        return res.status(409).json({
          success: false,
          code:
            "INVALID_SUSPENSION_STATE",
          message:
            "Only active organizations can be suspended.",
        });
      }

      const updated =
        await prisma.organization.update({
          where: {
            id:
              organizationId,
          },

          data: {
            status:
              "SUSPENDED",
          },

          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            updatedAt: true,
          },
        });

      await createPlatformAuditLog({
        req,

        action:
          "ORGANIZATION_SUSPENDED",

        resource:
          "ORGANIZATION",

        resourceId:
          updated.id,

        details:
          JSON.stringify({
            organizationName:
              updated.name,

            organizationSlug:
              updated.slug,

            previousStatus:
              organization.status,

            newStatus:
              updated.status,
          }),
      });

      return res.status(200).json({
        success: true,

        message:
          "Organization suspended successfully.",

        organization:
          updated,
      });
    } catch (error) {
      console.error(
        "[PLATFORM] Organization suspension failed:",
        error
      );

      return res.status(500).json({
        success: false,
        code:
          "ORGANIZATION_SUSPENSION_FAILED",
        message:
          "Unable to suspend organization.",
      });
    }
  };

/* =========================================================
   ACTIVATE ORGANIZATION

   PATCH /api/platform/organizations/:organizationId/activate

   SUSPENDED -> ACTIVE

   PENDING organizations must use /approve.
========================================================= */

export const activateOrganization =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const organizationId =
        typeof req.params.organizationId ===
        "string"
          ? req.params.organizationId.trim()
          : "";

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          code:
            "ORGANIZATION_REQUIRED",
          message:
            "Organization ID is required.",
        });
      }

      const organization =
        await prisma.organization.findUnique({
          where: {
            id:
              organizationId,
          },

          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
          },
        });

      if (!organization) {
        return res.status(404).json({
          success: false,
          code:
            "ORGANIZATION_NOT_FOUND",
          message:
            "Organization was not found.",
        });
      }

      if (
        organization.status ===
        "ACTIVE"
      ) {
        return res.status(200).json({
          success: true,

          message:
            "Organization is already active.",

          organization,
        });
      }

      if (
        organization.status ===
        "PENDING"
      ) {
        return res.status(409).json({
          success: false,
          code:
            "ORGANIZATION_APPROVAL_REQUIRED",
          message:
            "This organization must be approved before it can become active.",
        });
      }

      if (
        organization.status !==
        "SUSPENDED"
      ) {
        return res.status(409).json({
          success: false,
          code:
            "INVALID_ACTIVATION_STATE",
          message:
            "Only suspended organizations can be reactivated.",
        });
      }

      const updated =
        await prisma.organization.update({
          where: {
            id:
              organizationId,
          },

          data: {
            status:
              "ACTIVE",
          },

          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            updatedAt: true,
          },
        });

      await createPlatformAuditLog({
        req,

        action:
          "ORGANIZATION_ACTIVATED",

        resource:
          "ORGANIZATION",

        resourceId:
          updated.id,

        details:
          JSON.stringify({
            organizationName:
              updated.name,

            organizationSlug:
              updated.slug,

            previousStatus:
              organization.status,

            newStatus:
              updated.status,
          }),
      });

      return res.status(200).json({
        success: true,

        message:
          "Organization activated successfully.",

        organization:
          updated,
      });
    } catch (error) {
      console.error(
        "[PLATFORM] Organization activation failed:",
        error
      );

      return res.status(500).json({
        success: false,
        code:
          "ORGANIZATION_ACTIVATION_FAILED",
        message:
          "Unable to activate organization.",
      });
    }
  };
  /* =========================================================
   GET PLATFORM AUDIT LOGS

   GET /api/platform/audit-logs

   PLATFORM_ADMIN only.

   Optional filters:
   ?action=ORGANIZATION_APPROVED
   ?resource=ORGANIZATION
   ?resourceId=<id>
   ?limit=50

   Platform administrative activity only.
   Tenant financial audit trails remain separate.
========================================================= */

export const getPlatformAuditLogs =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const action =
        typeof req.query.action === "string"
          ? req.query.action.trim()
          : "";

      const resource =
        typeof req.query.resource === "string"
          ? req.query.resource.trim()
          : "";

      const resourceId =
        typeof req.query.resourceId === "string"
          ? req.query.resourceId.trim()
          : "";

      const requestedLimit =
        typeof req.query.limit === "string"
          ? Number.parseInt(
              req.query.limit,
              10
            )
          : 50;

      const limit =
        Number.isFinite(requestedLimit)
          ? Math.min(
              Math.max(
                requestedLimit,
                1
              ),
              100
            )
          : 50;

      const logs =
        await prisma.platformAuditLog.findMany({
          where: {
            ...(action
              ? {
                  action,
                }
              : {}),

            ...(resource
              ? {
                  resource,
                }
              : {}),

            ...(resourceId
              ? {
                  resourceId,
                }
              : {}),
          },

          select: {
            id: true,

            actorUserId: true,
            actorEmail: true,

            action: true,

            resource: true,
            resourceId: true,

            details: true,

            ipAddress: true,
            userAgent: true,

            createdAt: true,
          },

          orderBy: {
            createdAt: "desc",
          },

          take: limit,
        });

      return res.status(200).json({
        success: true,

        count:
          logs.length,

        limit,

        filters: {
          action:
            action || null,

          resource:
            resource || null,

          resourceId:
            resourceId || null,
        },

        auditLogs:
          logs,
      });
    } catch (error) {
      console.error(
        "[PLATFORM] Audit log fetch failed:",
        error
      );

      return res.status(500).json({
        success: false,
        code:
          "PLATFORM_AUDIT_LOG_FETCH_FAILED",
        message:
          "Unable to retrieve platform audit logs.",
      });
    }
  };