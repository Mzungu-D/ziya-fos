import { ensureTenantBaseline } from "../services/tenantProvisioning.service";
import { Response } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";

import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";
import { sendEmail } from "../config/mailer";

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

function normalizeEmail(value: unknown): string {
  return typeof value === "string"
    ? value.trim().toLowerCase()
    : "";
}

function generateInvitationToken(): string {
  return crypto.randomBytes(48).toString("base64url");
}

function hashInvitationToken(token: string): string {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function getAppUrl(): string {
  return (
    process.env.APP_URL?.trim() ||
    process.env.FRONTEND_URL?.trim() ||
    "https://ziyafos.com"
  ).replace(/\/$/, "");
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
      plan,
      billingCycle,
      ownerName,
      ownerEmail,
      ownerPhoneNumber,
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

    const normalizedPlan =
      typeof plan === "string" && plan.trim()
        ? plan.trim().toUpperCase()
        : "STARTER";

    const normalizedBillingCycle =
      typeof billingCycle === "string" && billingCycle.trim()
        ? billingCycle.trim().toUpperCase()
        : "MONTHLY";

    const normalizedCycle =
      normalizedBillingCycle === "ANNUAL"
        ? "YEARLY"
        : normalizedBillingCycle;

    const validPlans = [
      "STARTER",
      "PROFESSIONAL",
      "ENTERPRISE",
    ];

    if (!validPlans.includes(normalizedPlan)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PLAN",
        message: "The selected organization plan is invalid.",
      });
    }

    if (!["MONTHLY", "YEARLY"].includes(normalizedCycle)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_BILLING_CYCLE",
        message: "The selected billing cycle is invalid.",
      });
    }

    const normalizedOwnerName =
      typeof ownerName === "string"
        ? ownerName.trim().replace(/\s+/g, " ")
        : "";

    const normalizedOwnerEmail =
      normalizeEmail(ownerEmail);

    if (!normalizedOwnerName) {
      return res.status(400).json({
        success: false,
        code: "OWNER_NAME_REQUIRED",
        message: "Owner name is required.",
      });
    }

    if (!normalizedOwnerEmail) {
      return res.status(400).json({
        success: false,
        code: "OWNER_EMAIL_REQUIRED",
        message: "Owner email is required.",
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedOwnerEmail)) {
      return res.status(400).json({
        success: false,
        code: "OWNER_EMAIL_INVALID",
        message: "Please provide a valid Owner email address.",
      });
    }

    const baseSlug = generateSlug(name.trim());

    const existing = await prisma.organization.findUnique({
      where: {
        slug: baseSlug,
      },
      select: {
        id: true,
      },
    });

    const slug = existing
      ? uniqueSlug(baseSlug)
      : baseSlug;

    const existingOwner = await prisma.user.findUnique({
      where: {
        email: normalizedOwnerEmail,
      },
      select: {
        id: true,
        platformRole: true,
        isActive: true,
      },
    });

    if (existingOwner?.platformRole) {
      return res.status(409).json({
        success: false,
        code: "PLATFORM_ACCOUNT_NOT_ALLOWED",
        message:
          "A platform administrator account cannot be assigned as a tenant Owner.",
      });
    }

    if (existingOwner) {
      const existingMembership =
        await prisma.organizationMember.findFirst({
          where: {
            userId: existingOwner.id,
            organization: {
              status: {
                not: "REJECTED",
              },
            },
          },
          select: {
            id: true,
            organizationId: true,
          },
        });

      if (existingMembership) {
        return res.status(409).json({
          success: false,
          code: "OWNER_ALREADY_ASSIGNED",
          message:
            "This email address is already associated with an organization.",
        });
      }
    }

    const rawInvitationToken =
      generateInvitationToken();

    const tokenHash =
      hashInvitationToken(rawInvitationToken);

    const invitationExpiresAt =
      new Date(Date.now() + 72 * 60 * 60 * 1000);

    /*
     * The Owner does not receive a temporary password.
     * A random internal password is used until the Owner
     * activates the account and creates their own password.
     */
    const generatedPassword =
      crypto.randomBytes(48).toString("hex");

    const passwordHash =
      await bcrypt.hash(generatedPassword, 12);

    const result = await prisma.$transaction(
      async (tx) => {
        const organization =
          await tx.organization.create({
            data: {
              name: name.trim(),
              slug,
              country: country.trim().toUpperCase(),
              currency: currency.trim().toUpperCase(),
              status: "ACTIVE",

              legalName:
                typeof legalName === "string" &&
                legalName.trim()
                  ? legalName.trim()
                  : undefined,

              registrationNumber:
                typeof registrationNumber === "string" &&
                registrationNumber.trim()
                  ? registrationNumber.trim()
                  : undefined,

              taxNumber:
                typeof taxNumber === "string" &&
                taxNumber.trim()
                  ? taxNumber.trim()
                  : undefined,

              email:
                typeof email === "string" &&
                email.trim()
                  ? email.trim().toLowerCase()
                  : undefined,

              phoneNumber:
                typeof phoneNumber === "string" &&
                phoneNumber.trim()
                  ? phoneNumber.trim()
                  : undefined,

              address:
                typeof address === "string" &&
                address.trim()
                  ? address.trim()
                  : undefined,

              logoUrl:
                typeof logoUrl === "string" &&
                logoUrl.trim()
                  ? logoUrl.trim()
                  : undefined,
            },
          });

        // Every newly created tenant receives the same baseline:
        // standard Chart of Accounts + normalized tenant memberships.
        await ensureTenantBaseline(
          tx,
          organization.id
        );

        await tx.subscription.create({
          data: {
            organizationId: organization.id,
            plan: normalizedPlan,
            status: "ACTIVE",
            billingCycle: normalizedCycle,
            amount: 0,
            currency: currency.trim().toUpperCase(),
            startDate: new Date(),
            endDate: null,
            trialEndsAt: null,
            cancelledAt: null,
            notes:
              "Provisioned by Platform Administration. No automatic expiry.",
          },
        });

        const owner = existingOwner
          ? await tx.user.update({
              where: {
                id: existingOwner.id,
              },
              data: {
                name: normalizedOwnerName,
                role: "OWNER",
                isActive: true,
                phoneNumber:
                  typeof ownerPhoneNumber === "string" &&
                  ownerPhoneNumber.trim()
                    ? ownerPhoneNumber.trim()
                    : undefined,
              },
            })
          : await tx.user.create({
              data: {
                name: normalizedOwnerName,
                email: normalizedOwnerEmail,
                password: passwordHash,
                role: "OWNER",
                isActive: true,
                phoneNumber:
                  typeof ownerPhoneNumber === "string" &&
                  ownerPhoneNumber.trim()
                    ? ownerPhoneNumber.trim()
                    : null,
              },
            });

        await tx.organizationMember.create({
          data: {
            userId: owner.id,
            organizationId: organization.id,
            role: "OWNER",
            permissions: ["*"],
            isActive: true,
            isDefault: true,
          },
        });

        await tx.organizationInvitation.create({
          data: {
            organizationId: organization.id,
            email: normalizedOwnerEmail,
            role: "OWNER",
            permissions: ["*"],
            tokenHash,
            status: "PENDING",
            invitedByUserId: req.user!.userId,
            expiresAt: invitationExpiresAt,
          },
        });

        return {
          organization,
          owner,
        };
      }
    );

    const activationUrl =
      `${getAppUrl()}/invite/${encodeURIComponent(
        rawInvitationToken
      )}`;

    try {
      await sendEmail(
        normalizedOwnerEmail,
        `Welcome to Ziya FOS óù ${result.organization.name}`,
        `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;color:#20243A;">
  <div style="max-width:620px;margin:40px auto;background:#ffffff;border-radius:12px;padding:40px;">
    <div style="font-size:22px;font-weight:700;margin-bottom:28px;">
      Ziya FOS
    </div>

    <h1 style="font-size:28px;margin:0 0 16px;">
      Welcome to ${result.organization.name}
    </h1>

    <p style="font-size:15px;line-height:1.7;">
      Your organization has been provisioned on Ziya FOS by the
      platform administration team.
    </p>

    <p style="font-size:15px;line-height:1.7;">
      You have been designated as the Owner of this organization.
      Activate your account to create your secure password and
      access your company's financial workspace.
    </p>

    <div style="background:#f7f7f8;border-radius:8px;padding:20px;margin:24px 0;">
      <p style="margin:0 0 8px;"><strong>Organization:</strong> ${result.organization.name}</p>
      <p style="margin:0 0 8px;"><strong>Plan:</strong> ${normalizedPlan}</p>
      <p style="margin:0;"><strong>Billing cycle:</strong> ${normalizedCycle}</p>
    </div>

    <a
      href="${activationUrl}"
      style="display:inline-block;background:#20243A;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:7px;font-weight:600;"
    >
      Activate your Ziya FOS account
    </a>

    <p style="font-size:13px;line-height:1.6;color:#666;margin-top:28px;">
      This secure activation link expires in 72 hours and can only be used once.
      If you did not expect this invitation, you can safely ignore this email.
    </p>

    <p style="font-size:13px;color:#888;margin-top:32px;">
      Ziya FOS<br>
      simple.ethical.future.
    </p>
  </div>
</body>
</html>
        `
      );
    } catch (emailError) {
      console.error(
        "[PLATFORM:ORGANIZATION] Owner invitation email failed:",
        emailError
      );
    }

    return res.status(201).json({
      success: true,
      message:
        "Organization created successfully and the Owner activation invitation has been sent.",
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        slug: result.organization.slug,
        status: result.organization.status,
        plan: normalizedPlan,
        billingCycle: normalizedCycle,
        memberCount: 1,
      },
    });
  } catch (error) {
    console.error(
      "[PLATFORM:ORGANIZATION] Create error:",
      error
    );

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
   Updates editable fields only óù status changes use
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
   Transition: PENDING ? ACTIVE
========================================================= */

export const approveOrganization = async (
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
        status: true,
        email: true,
        memberships: {
          where: {
            role: "OWNER",
            isActive: true,
          },
          select: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          take: 1,
        },
        subscription: {
          select: {
            id: true,
            status: true,
            plan: true,
            billingCycle: true,
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

    if (organization.status !== "PENDING") {
      return res.status(409).json({
        success: false,
        code: "INVALID_STATUS_TRANSITION",
        message: "Only organizations with PENDING status can be approved.",
      });
    }

    const owner = organization.memberships[0]?.user;

    if (!owner) {
      return res.status(409).json({
        success: false,
        code: "OWNER_NOT_FOUND",
        message:
          "This organization cannot be approved because no active Owner account was found.",
      });
    }

    /*
     * Approval is atomic:
     *
     * Organization: PENDING -> ACTIVE
     * Subscription: PENDING/TRIAL -> ACTIVE
     *
     * No automatic expiry is introduced.
     */
    await prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id },
        data: {
          status: "ACTIVE",
        },
      });

      if (organization.subscription) {
        await tx.subscription.update({
          where: {
            id: organization.subscription.id,
          },
          data: {
            status: "ACTIVE",
            startDate: new Date(),
            endDate: null,
            trialEndsAt: null,
            cancelledAt: null,
          },
        });
      } else {
        await tx.subscription.create({
          data: {
            organizationId: organization.id,
            plan: "STARTER",
            status: "ACTIVE",
            billingCycle: "MONTHLY",
            amount: 0,
            currency: "KES",
            startDate: new Date(),
            endDate: null,
            trialEndsAt: null,
            cancelledAt: null,
            notes:
              "Subscription activated during Platform Administration approval.",
          },
        });
      }

      await tx.platformAuditLog.create({
        data: {
          actorUserId: req.user!.userId,
          actorEmail: req.user!.userId ?? "unknown",
          action: "ORGANIZATION_APPROVED",
          resource: "ORGANIZATION",
          resourceId: organization.id,
          details:
            `Organization "${organization.name}" approved by Platform Administration. Owner: ${owner.email}.`,
        },
      });
    });

    /*
     * Notify the Owner after successful activation.
     */
    try {
      const loginUrl = `${getAppUrl()}/login`;

      await sendEmail(
        owner.email,
        "Your Ziya FOS organization is approved ó",
        `
<html>
<body style="margin:0;padding:0;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;color:#20243A;">
  <div style="max-width:620px;margin:40px auto;background:#ffffff;border-radius:12px;padding:40px;">

    <div style="font-size:22px;font-weight:700;margin-bottom:28px;">
      Ziya FOS
    </div>

    <h1 style="font-size:28px;margin:0 0 16px;">
      Your organization has been approved
    </h1>

    <p style="font-size:15px;line-height:1.7;">
      Hello ${owner.name},
    </p>

    <p style="font-size:15px;line-height:1.7;">
      Good news. Your organization
      <strong>${organization.name}</strong>
      has been approved and is now active on Ziya FOS.
    </p>

    <div style="background:#f7f7f8;border-radius:8px;padding:20px;margin:24px 0;">
      <p style="margin:0 0 8px;">
        <strong>Organization:</strong> ${organization.name}
      </p>
      <p style="margin:0 0 8px;">
        <strong>Plan:</strong> ${organization.subscription?.plan ?? "STARTER"}
      </p>
      <p style="margin:0;">
        <strong>Billing cycle:</strong> ${organization.subscription?.billingCycle ?? "MONTHLY"}
      </p>
    </div>

    <p style="font-size:15px;line-height:1.7;">
      You can now sign in using the email address and password you
      provided during registration.
    </p>

    <p style="margin:28px 0;">
      <a
        href="${loginUrl}"
        style="display:inline-block;background:#20243A;color:#ffffff;text-decoration:none;padding:14px 26px;border-radius:7px;font-weight:600;"
      >
        Open Ziya FOS
      </a>
    </p>

    <p style="font-size:13px;line-height:1.6;color:#666;">
      As the Owner, you have full administrative visibility within
      your organization's FOS workspace and can manage users and
      access from Settings.
    </p>

    <p style="font-size:13px;color:#888;margin-top:32px;">
      Ziya FOS<br>
      simple.ethical.future.
    </p>

  </div>
</body>
</html>
        `
      );
    } catch (emailError) {
      /*
       * The organization is already approved. Email failure should
       * not roll back the successful approval.
       */
      console.error(
        "[PLATFORM:ORGANIZATION] Approval email failed:",
        emailError
      );
    }

    return res.status(200).json({
      success: true,
      message:
        `Organization "${organization.name}" has been approved and activated.`,
      organization: {
        id: organization.id,
        name: organization.name,
        status: "ACTIVE",
        subscription: {
          plan: organization.subscription?.plan ?? "STARTER",
          status: "ACTIVE",
          billingCycle:
            organization.subscription?.billingCycle ?? "MONTHLY",
          trialEndsAt: null,
          endDate: null,
        },
        owner: {
          name: owner.name,
          email: owner.email,
        },
      },
    });
  } catch (error) {
    console.error(
      "[PLATFORM:ORGANIZATION] Approve error:",
      error
    );

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
   Transition: PENDING ? REJECTED
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
   Transition: ACTIVE ? SUSPENDED
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
   Transition: SUSPENDED ? ACTIVE
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


