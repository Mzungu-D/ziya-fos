import { Response } from "express";

import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

/* =========================================================
   PLATFORM SESSION GUARD
========================================================= */

function requirePlatformSession(
  req: AuthRequest,
  res: Response
): boolean {
  if (!req.user) {
    res.status(401).json({
      success: false,
      code: "AUTH_REQUIRED",
      message: "Authentication required.",
    });
    return false;
  }

  if (req.user.sessionType !== "PLATFORM") {
    res.status(403).json({
      success: false,
      code: "PLATFORM_SESSION_REQUIRED",
      message: "A platform administration session is required.",
    });
    return false;
  }

  return true;
}

/* =========================================================
   HELPERS
========================================================= */

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function uniqueSlug(base: string): string {
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base}-${suffix}`;
}

/* =========================================================
   LIST ALL ORGANIZATIONS

   GET /api/platform/organizations
   GET /api/platform/organizations?status=ACTIVE|PENDING|SUSPENDED
========================================================= */

export const listOrganizations = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!requirePlatformSession(req, res)) return;

    const status =
      typeof req.query.status === "string"
        ? req.query.status.toUpperCase()
        : undefined;

    const validStatuses = ["PENDING", "ACTIVE", "SUSPENDED", "REJECTED"];

    const whereStatus =
      status && validStatuses.includes(status)
        ? (status as "PENDING" | "ACTIVE" | "SUSPENDED" | "REJECTED")
        : undefined;

    const organizations = await prisma.organization.findMany({
      where: whereStatus ? { status: whereStatus } : undefined,

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
          select: { id: true },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    const shaped = organizations.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      legalName: org.legalName,
      registrationNumber: org.registrationNumber,
      taxNumber: org.taxNumber,
      email: org.email,
      phoneNumber: org.phoneNumber,
      address: org.address,
      country: org.country,
      currency: org.currency,
      logoUrl: org.logoUrl,
      status: org.status,
      memberCount: org.memberships.length,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    }));

    return res.status(200).json({
      success: true,
      count: shaped.length,
      organizations: shaped,
    });
  } catch (error) {
    console.error("[PLATFORM:ORGANIZATION] List error:", error);

    return res.status(500).json({
      success: false,
      code: "ORGANIZATION_LIST_FAILED",
      message: "Unable to retrieve organizations.",
    });
  }
};

/* =========================================================
   GET SINGLE ORGANIZATION

   GET /api/platform/organizations/:id
   Returns full details including all members.
========================================================= */

export const getOrganization = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!requirePlatformSession(req, res)) return;

    const id = req.params.id as string;

    if (!id) {
      return res.status(400).json({
        success: false,
        code: "ORGANIZATION_ID_REQUIRED",
        message: "Organization ID is required.",
      });
    }

    const organization = await prisma.organization.findUnique({
      where: { id },

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
            userId: true,
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
                lastLoginAt: true,
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
        code: "ORGANIZATION_NOT_FOUND",
        message: "Organization not found.",
      });
    }

    return res.status(200).json({
      success: true,

      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        legalName: organization.legalName,
        registrationNumber: organization.registrationNumber,
        taxNumber: organization.taxNumber,
        email: organization.email,
        phoneNumber: organization.phoneNumber,
        address: organization.address,
        country: organization.country,
        currency: organization.currency,
        logoUrl: organization.logoUrl,
        status: organization.status,
        memberCount: organization.memberships.length,
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt,

        members: organization.memberships.map((m) => ({
          id: m.id,
          userId: m.userId,
          role: m.role,
          isActive: m.isActive,
          isDefault: m.isDefault,
          joinedAt: m.joinedAt,
          user: m.user,
        })),
      },
    });
  } catch (error) {
    console.error("[PLATFORM:ORGANIZATION] Get error:", error);

    return res.status(500).json({
      success: false,
      code: "ORGANIZATION_FETCH_FAILED",
      message: "Unable to retrieve organization.",
    });
  }
};

/* =========================================================
   CREATE ORGANIZATION

   POST /api/platform/organizations
   Creates organization with PENDING status.
========================================================= */

export const createOrganization = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!requirePlatformSession(req, res)) return;

    const {
      name,
      country,
      currency,
      legalName,
      registrationNumber,
      taxNumber,
      email,
      phoneNumber,
      address,
      logoUrl,
    } = req.body ?? {};

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        code: "NAME_REQUIRED",
        message: "Organization name is required.",
      });
    }

    if (typeof country !== "string" || !country.trim()) {
      return res.status(400).json({
        success: false,
        code: "COUNTRY_REQUIRED",
        message: "Country is required.",
      });
    }

    if (typeof currency !== "string" || !currency.trim()) {
      return res.status(400).json({
        success: false,
        code: "CURRENCY_REQUIRED",
        message: "Currency is required.",
      });
    }

    const baseSlug = generateSlug(name.trim());

    const existing = await prisma.organization.findUnique({
      where: { slug: baseSlug },
      select: { id: true },
    });

    const slug = existing ? uniqueSlug(baseSlug) : baseSlug;

    const organization = await prisma.organization.create({
      data: {
        name: name.trim(),
        slug,
        country: country.trim().toUpperCase(),
        currency: currency.trim().toUpperCase(),
        status: "PENDING",

        legalName:
          typeof legalName === "string" && legalName.trim()
            ? legalName.trim()
            : undefined,

        registrationNumber:
          typeof registrationNumber === "string" && registrationNumber.trim()
            ? registrationNumber.trim()
            : undefined,

        taxNumber:
          typeof taxNumber === "string" && taxNumber.trim()
            ? taxNumber.trim()
            : undefined,

        email:
          typeof email === "string" && email.trim()
            ? email.trim().toLowerCase()
            : undefined,

        phoneNumber:
          typeof phoneNumber === "string" && phoneNumber.trim()
            ? phoneNumber.trim()
            : undefined,

        address:
          typeof address === "string" && address.trim()
            ? address.trim()
            : undefined,

        logoUrl:
          typeof logoUrl === "string" && logoUrl.trim()
            ? logoUrl.trim()
            : undefined,
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
      },
    });

    return res.status(201).json({
      success: true,
      message: "Organization created successfully.",
      organization: { ...organization, memberCount: 0 },
    });
  } catch (error) {
    console.error("[PLATFORM:ORGANIZATION] Create error:", error);

    return res.status(500).json({
      success: false,
      code: "ORGANIZATION_CREATE_FAILED",
      message: "Unable to create organization.",
    });
  }
};

/* =========================================================
   UPDATE ORGANIZATION

   PATCH /api/platform/organizations/:id
   Updates editable fields only — status changes use
   /approve, /suspend, /activate, /reject.
========================================================= */

export const updateOrganization = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!requirePlatformSession(req, res)) return;

    const id = req.params.id as string;

    if (!id) {
      return res.status(400).json({
        success: false,
        code: "ORGANIZATION_ID_REQUIRED",
        message: "Organization ID is required.",
      });
    }

    const {
      name,
      legalName,
      registrationNumber,
      taxNumber,
      email,
      phoneNumber,
      address,
      currency,
      logoUrl,
    } = req.body ?? {};

    const data: Record<string, unknown> = {};

    if (typeof name === "string" && name.trim()) {
      data.name = name.trim();
    }

    if (typeof legalName === "string") {
      data.legalName = legalName.trim() || null;
    }

    if (typeof registrationNumber === "string") {
      data.registrationNumber = registrationNumber.trim() || null;
    }

    if (typeof taxNumber === "string") {
      data.taxNumber = taxNumber.trim() || null;
    }

    if (typeof email === "string") {
      data.email = email.trim().toLowerCase() || null;
    }

    if (typeof phoneNumber === "string") {
      data.phoneNumber = phoneNumber.trim() || null;
    }

    if (typeof address === "string") {
      data.address = address.trim() || null;
    }

    if (typeof currency === "string" && currency.trim()) {
      data.currency = currency.trim().toUpperCase();
    }

    if (typeof logoUrl === "string") {
      data.logoUrl = logoUrl.trim() || null;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        success: false,
        code: "NO_FIELDS_PROVIDED",
        message: "No valid fields provided to update.",
      });
    }

    const [organization, memberCount] = await Promise.all([
      prisma.organization.update({
        where: { id },
        data,

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
        },
      }),

      prisma.organization
        .findUnique({
          where: { id },
          select: { memberships: { select: { id: true } } },
        })
        .then((o) => o?.memberships.length ?? 0),
    ]);

    return res.status(200).json({
      success: true,
      message: "Organization updated successfully.",
      organization: {
        ...organization,
        memberCount,
      },
    });
  } catch (error) {
    console.error("[PLATFORM:ORGANIZATION] Update error:", error);

    return res.status(500).json({
      success: false,
      code: "ORGANIZATION_UPDATE_FAILED",
      message: "Unable to update organization.",
    });
  }
};

/* =========================================================
   DELETE ORGANIZATION

   DELETE /api/platform/organizations/:id
========================================================= */

export const deleteOrganization = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!requirePlatformSession(req, res)) return;

    const id = req.params.id as string;

    if (!id) {
      return res.status(400).json({
        success: false,
        code: "ORGANIZATION_ID_REQUIRED",
        message: "Organization ID is required.",
      });
    }

    const exists = await prisma.organization.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!exists) {
      return res.status(404).json({
        success: false,
        code: "ORGANIZATION_NOT_FOUND",
        message: "Organization not found.",
      });
    }

    await prisma.organization.delete({ where: { id } });

    return res.status(200).json({
      success: true,
      message: `Organization "${exists.name}" has been deleted.`,
    });
  } catch (error) {
    console.error("[PLATFORM:ORGANIZATION] Delete error:", error);

    return res.status(500).json({
      success: false,
      code: "ORGANIZATION_DELETE_FAILED",
      message: "Unable to delete organization.",
    });
  }
};

/* =========================================================
   APPROVE ORGANIZATION

   PATCH /api/platform/organizations/:id/approve
   Transition: PENDING → ACTIVE
========================================================= */

export const approveOrganization = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!requirePlatformSession(req, res)) return;

    const id = req.params.id as string;

    const organization = await prisma.organization.findUnique({
      where: { id },
      select: { id: true, name: true, status: true },
    });

    if (!organization) {
      return res.status(404).json({
        success: false,
        code: "ORGANIZATION_NOT_FOUND",
        message: "Organization not found.",
      });
    }

    if (organization.status !== "PENDING") {
      return res.status(409).json({
        success: false,
        code: "INVALID_STATUS_TRANSITION",
        message: "Only organizations with PENDING status can be approved.",
      });
    }

    await prisma.organization.update({
      where: { id },
      data: { status: "ACTIVE" },
    });

    return res.status(200).json({
      success: true,
      message: `Organization "${organization.name}" has been approved.`,
    });
  } catch (error) {
    console.error("[PLATFORM:ORGANIZATION] Approve error:", error);

    return res.status(500).json({
      success: false,
      code: "ORGANIZATION_APPROVE_FAILED",
      message: "Unable to approve organization.",
    });
  }
};

/* =========================================================
   REJECT ORGANIZATION

   PATCH /api/platform/organizations/:id/reject
   Transition: PENDING → REJECTED
========================================================= */

export const rejectOrganization = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!requirePlatformSession(req, res)) return;

    const id = req.params.id as string;

    const organization = await prisma.organization.findUnique({
      where: { id },
      select: { id: true, name: true, status: true },
    });

    if (!organization) {
      return res.status(404).json({
        success: false,
        code: "ORGANIZATION_NOT_FOUND",
        message: "Organization not found.",
      });
    }

    if (organization.status !== "PENDING") {
      return res.status(409).json({
        success: false,
        code: "INVALID_STATUS_TRANSITION",
        message: "Only organizations with PENDING status can be rejected.",
      });
    }

    await prisma.organization.update({
      where: { id },
      data: { status: "REJECTED" },
    });

    return res.status(200).json({
      success: true,
      message: `Organization "${organization.name}" has been rejected.`,
    });
  } catch (error) {
    console.error("[PLATFORM:ORGANIZATION] Reject error:", error);

    return res.status(500).json({
      success: false,
      code: "ORGANIZATION_REJECT_FAILED",
      message: "Unable to reject organization.",
    });
  }
};

/* =========================================================
   SUSPEND ORGANIZATION

   PATCH /api/platform/organizations/:id/suspend
   Transition: ACTIVE → SUSPENDED
========================================================= */

export const suspendOrganization = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!requirePlatformSession(req, res)) return;

    const id = req.params.id as string;

    const organization = await prisma.organization.findUnique({
      where: { id },
      select: { id: true, name: true, status: true },
    });

    if (!organization) {
      return res.status(404).json({
        success: false,
        code: "ORGANIZATION_NOT_FOUND",
        message: "Organization not found.",
      });
    }

    if (organization.status !== "ACTIVE") {
      return res.status(409).json({
        success: false,
        code: "INVALID_STATUS_TRANSITION",
        message: "Only organizations with ACTIVE status can be suspended.",
      });
    }

    await prisma.organization.update({
      where: { id },
      data: { status: "SUSPENDED" },
    });

    return res.status(200).json({
      success: true,
      message: `Organization "${organization.name}" has been suspended.`,
    });
  } catch (error) {
    console.error("[PLATFORM:ORGANIZATION] Suspend error:", error);

    return res.status(500).json({
      success: false,
      code: "ORGANIZATION_SUSPEND_FAILED",
      message: "Unable to suspend organization.",
    });
  }
};

/* =========================================================
   ACTIVATE ORGANIZATION

   PATCH /api/platform/organizations/:id/activate
   Transition: SUSPENDED → ACTIVE
========================================================= */

export const activateOrganization = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!requirePlatformSession(req, res)) return;

    const id = req.params.id as string;

    const organization = await prisma.organization.findUnique({
      where: { id },
      select: { id: true, name: true, status: true },
    });

    if (!organization) {
      return res.status(404).json({
        success: false,
        code: "ORGANIZATION_NOT_FOUND",
        message: "Organization not found.",
      });
    }

    if (organization.status !== "SUSPENDED") {
      return res.status(409).json({
        success: false,
        code: "INVALID_STATUS_TRANSITION",
        message: "Only organizations with SUSPENDED status can be reactivated.",
      });
    }

    await prisma.organization.update({
      where: { id },
      data: { status: "ACTIVE" },
    });

    return res.status(200).json({
      success: true,
      message: `Organization "${organization.name}" has been reactivated.`,
    });
  } catch (error) {
    console.error("[PLATFORM:ORGANIZATION] Activate error:", error);

    return res.status(500).json({
      success: false,
      code: "ORGANIZATION_ACTIVATE_FAILED",
      message: "Unable to reactivate organization.",
    });
  }
};