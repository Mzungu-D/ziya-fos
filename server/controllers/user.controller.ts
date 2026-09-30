import { Response } from "express";
import crypto from "crypto";

import prisma from "../config/prisma";
import { sendEmail } from "../config/mailer";
import { normalizeKenyanPhoneNumber } from "../services/infinityTech.service";

import {
  AuthRequest,
} from "../middleware/auth.middleware";

import {
  getRoleTemplatePermissions,
  isRoleTemplate,
} from "../config/roleTemplates";

/* =========================================================
   TENANT PERMISSION CATALOGUE
========================================================= */

const VALID_PERMISSIONS = new Set<string>([
  "users.view",
  "users.create",
  "users.manageAccess",
  "users.manageStatus",
  "users.delete",

  "account.view",
  "account.create",
  "account.update",
  "account.delete",

  "accountsPayable.view",
  "accountsPayable.create",
  "accountsPayable.approve",
  "accountsPayable.payment",
  "accountsPayable.delete",

  "accountsReceivable.view",
  "accountsReceivable.create",
  "accountsReceivable.approve",
  "accountsReceivable.payment",
  "accountsReceivable.update",
  "accountsReceivable.delete",

  "approval.view",
  "approval.approve",
  "approval.reject",

  "bankAccount.view",
  "bankAccount.create",
  "bankAccount.update",
  "bankAccount.delete",

  "bankPayment.view",
  "bankPayment.create",

  "budget.view",
  "budget.create",
  "budget.update",
  "budget.delete",

  "document.view",
  "document.create",
  "document.delete",

  "expense.view",
  "expense.create",

  "fraud.view",
  "fraud.analyze",

  "investment.view",
  "investment.create",

  "invoice.view",
  "invoice.create",

  "journal.view",
  "journal.create",
  "journal.update",
  "journal.post",
  "journal.approve",
  "journal.reverse",
  "journal.delete",

  "ledger.view",

  "portfolioCompany.view",
  "portfolioCompany.create",
  "portfolioCompany.update",
  "portfolioCompany.delete",

  "reports.view",

  "vendor.view",
  "vendor.create",
  "vendor.update",
  "vendor.status",
  "vendor.delete",

  /* HR / Payroll */
  "employee.view",
  "employee.create",
  "employee.update",
  "employee.delete",
  "payroll.view",
  "payroll.create",
  "payroll.update",

  /* Procurement */
  "procurement.view",
  "procurement.create",
  "procurement.update",
  "procurement.status",

  /* Assets */
  "asset.view",
  "asset.create",
  "asset.update",
  "asset.delete",
  "assetAssignment.view",
  "assetAssignment.create",
  "assetAssignment.update",

  /* M-Pesa */
  "mpesa.view",
  "mpesa.create",

  /* Tax */
  "tax.view",
  "tax.file",
  "tax.payment",

  /* Security */
  "security.sessions.view",
  "security.sessions.revoke",
]);

/* =========================================================
   TENANT CONTEXT
========================================================= */

const getTenantContext = (
  req: AuthRequest
) => {
  if (!req.user) {
    return null;
  }

  if (
    req.user.sessionType !== "TENANT"
  ) {
    return null;
  }

  if (
    !req.user.userId ||
    !req.user.organizationId
  ) {
    return null;
  }

  return {
    userId:
      req.user.userId.trim(),

    organizationId:
      req.user.organizationId.trim(),
  };
};

/* =========================================================
   TENANT MANAGEMENT AUTHORIZATION

   Tenant isolation answers "which organization?"
   This helper answers "is the current user allowed to
   perform this management action?"

   OWNER has full tenant-management authority.
   Other users must hold the exact management permission.
========================================================= */

async function requireTenantPermission(
  req: AuthRequest,
  organizationId: string,
  permission: string
): Promise<
  | {
      allowed: true;
      role: string;
      permissions: string[];
    }
  | {
      allowed: false;
      status: number;
      code: string;
      message: string;
    }
> {
  const userId = req.user?.userId?.trim();

  if (!userId) {
    return {
      allowed: false,
      status: 403,
      code: "TENANT_SESSION_REQUIRED",
      message: "A tenant session is required.",
    };
  }

  const membership =
    await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
      select: {
        role: true,
        permissions: true,
        isActive: true,
        user: {
          select: {
            isActive: true,
            platformRole: true,
          },
        },
      },
    });

  if (!membership) {
    return {
      allowed: false,
      status: 403,
      code: "TENANT_MEMBERSHIP_REQUIRED",
      message:
        "You do not have access to this organization.",
    };
  }

  if (!membership.isActive || !membership.user.isActive) {
    return {
      allowed: false,
      status: 403,
      code: "TENANT_ACCESS_DISABLED",
      message:
        "Your organization access is disabled.",
    };
  }

  if (membership.user.platformRole) {
    return {
      allowed: false,
      status: 403,
      code: "PLATFORM_ACCOUNT_RESTRICTED",
      message:
        "Platform administration accounts cannot use tenant user management.",
    };
  }

  /*
   * Standard roles are always resolved from the current server-side
   * role template. This prevents stale membership.permissions from
   * granting or displaying permissions that are no longer part of
   * the assigned role.
   *
   * CUSTOM keeps its explicitly stored permission set.
   *
   * OWNER retains full tenant-management authority.
   */
  const permissions =
    membership.role === "OWNER"
      ? ["*"]
      : isRoleTemplate(membership.role)
        ? getRoleTemplatePermissions(membership.role)
        : membership.role === "CUSTOM"
          ? membership.permissions ?? []
          : [];

  const allowed =
    membership.role === "OWNER" ||
    permissions.includes("*") ||
    permissions.includes(permission);

  if (!allowed) {
    return {
      allowed: false,
      status: 403,
      code: "INSUFFICIENT_PERMISSION",
      message:
        "You do not have permission to perform this action.",
    };
  }

  return {
    allowed: true,
    role: membership.role,
    permissions,
  };
}

/* =========================================================
   PERMISSION BOUNDARY

   A non-OWNER administrator cannot grant access that
   exceeds their own permissions. This prevents a user
   with users.manageAccess from promoting another user
   into a more powerful role or custom permission set.
========================================================= */

function canGrantPermissions(
  actorRole: string,
  actorPermissions: string[],
  targetPermissions: string[]
): boolean {
  if (actorRole === "OWNER") {
    return true;
  }

  if (targetPermissions.includes("*")) {
    return false;
  }

  const actorSet =
    new Set(actorPermissions);

  return targetPermissions.every(
    (permission) =>
      actorSet.has(permission)
  );
}

/* =========================================================
   EMAIL HTML SAFETY
========================================================= */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/\'/g, "&#39;");
}

/* =========================================================
   INVITATION ACCESS SUMMARY
========================================================= */

const PERMISSION_LABELS: Record<string, string> = {
  account: "Chart of Accounts", accountsPayable: "Accounts Payable", accountsReceivable: "Accounts Receivable",
  bankAccount: "Cash & Banking", bankPayment: "Bank Payments", budget: "Budgeting", document: "Documents",
  expense: "Expenses", fraud: "Fraud Detection", investment: "Investments", invoice: "Invoicing",
  journal: "Journal Entries", ledger: "General Ledger", mpesa: "M-Pesa", portfolioCompany: "Portfolio Companies",
  reports: "Financial Reports", vendor: "Vendors", tax: "Tax Management", employee: "HR Management",
  payroll: "Payroll", procurement: "Procurement", asset: "Fixed Assets", assetAssignment: "Asset Assignments",
  approval: "Approvals", users: "User Management", security: "Security Sessions",
};

const ACTION_LABELS: Record<string, string> = {
  create: "Create", update: "Update", delete: "Delete", approve: "Approve", payment: "Process Payments",
  post: "Post", reverse: "Reverse", file: "File", status: "Manage Status", manageAccess: "Manage Access",
  manageStatus: "Manage Status", revoke: "Revoke Sessions", analyze: "Analyze",
};

function getPermissionModule(permission: string): string {
  const [module] = permission.split(".");
  return PERMISSION_LABELS[module] ?? module;
}

function getPermissionAction(permission: string): string | null {
  const parts = permission.split(".");
  if (parts.length < 2 || parts[1] === "view") return null;
  return ACTION_LABELS[parts[1]] ?? parts[1].replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildInvitationAccess(permissions: string[]) {
  const unique = [...new Set(permissions)];
  return {
    modules: [...new Set(unique.filter((p) => p.endsWith(".view")).map(getPermissionModule))],
    actions: [...new Set(unique.map((p) => {
      const action = getPermissionAction(p);
      return action ? `${getPermissionModule(p)} — ${action}` : null;
    }).filter((value): value is string => Boolean(value)))],
  };
}

/* =========================================================
   PHONE NORMALIZATION

   Invitations store the same canonical Kenyan phone format
   used by authentication so the invited phone is the exact
   identifier available for phone login.
========================================================= */

function maskPhoneNumber(phoneNumber: string): string {
  if (phoneNumber.length <= 4) {
    return "****";
  }

  return `${"*".repeat(Math.max(0, phoneNumber.length - 4))}${phoneNumber.slice(-4)}`;
}

function normalizeInvitedPhone(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const raw = value.trim();

  if (!raw) {
    return null;
  }

  try {
    return normalizeKenyanPhoneNumber(raw);
  } catch {
    return null;
  }
}

/* =========================================================
   NORMALIZE ROLE
========================================================= */

function normalizeRole(
  value: unknown
): string | null {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const role =
    value.trim().toUpperCase();

  if (!role) {
    return null;
  }

  return role;
}

/* =========================================================
   CUSTOM PERMISSION VALIDATION
========================================================= */

function normalizePermissions(
  value: unknown
): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const permissions = [
    ...new Set(
      value
        .filter(
          (
            permission
          ): permission is string =>
            typeof permission ===
            "string"
        )
        .map(
          (permission) =>
            permission.trim()
        )
        .filter(
          (permission) =>
            permission.length > 0
        )
    ),
  ];

  /*
   * Wildcard access is reserved exclusively for OWNER.
   * CUSTOM must never be able to manufacture OWNER access.
   */
  if (permissions.includes("*")) {
    return null;
  }

  const invalidPermission =
    permissions.find(
      (permission) =>
        !VALID_PERMISSIONS.has(
          permission
        )
    );

  if (invalidPermission) {
    return null;
  }

  return permissions;
}

/* =========================================================
   RESOLVE ROLE PERMISSIONS

   STANDARD ROLE:
   Server applies role template permissions.

   CUSTOM:
   Client may supply explicit permissions.
========================================================= */

function resolveRolePermissions(
  role: string,
  requestedPermissions: unknown
):
  | {
      success: true;
      permissions: string[];
    }
  | {
      success: false;
      code: string;
      message: string;
    } {
  if (role === "OWNER") {
    return {
      success: false,
      code: "OWNER_ROLE_RESTRICTED",
      message:
        "The OWNER role cannot be assigned through normal user management.",
    };
  }

  if (isRoleTemplate(role)) {
    return {
      success: true,
      permissions:
        getRoleTemplatePermissions(
          role
        ),
    };
  }

  if (role === "CUSTOM") {
    const permissions =
      normalizePermissions(
        requestedPermissions
      );

    if (permissions === null) {
      return {
        success: false,
        code: "INVALID_PERMISSIONS",
        message:
          "CUSTOM requires a valid permissions array.",
      };
    }

    return {
      success: true,
      permissions,
    };
  }

  return {
    success: false,
    code: "INVALID_ROLE",
    message:
      "The selected organization role is not supported.",
  };
}

/* =========================================================
   GET ORGANIZATION USERS

   GET /api/users
========================================================= */

export const getUsers = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const context =
      getTenantContext(req);

    if (!context) {
      return res.status(403).json({
        success: false,
        code:
          "TENANT_SESSION_REQUIRED",
        message:
          "A tenant session is required.",
      });
    }

    const authorization =
      await requireTenantPermission(
        req,
        context.organizationId,
        "users.view"
      );

    if (!authorization.allowed) {
      return res.status(
        authorization.status
      ).json({
        success: false,
        code: authorization.code,
        message: authorization.message,
      });
    }

    const members =
      await prisma.organizationMember.findMany({
        where: {
          organizationId:
            context.organizationId,
        },

        orderBy: [
          {
            role: "asc",
          },
          {
            joinedAt: "asc",
          },
        ],

        select: {
          id: true,
          userId: true,
          role: true,
          permissions: true,
          isActive: true,
          isDefault: true,
          joinedAt: true,
          updatedAt: true,

          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phoneNumber: true,
              isActive: true,
              platformRole: true,
              createdAt: true,
            },
          },
        },
      });

    const users =
      members
        .filter(
          (membership) =>
            !membership.user
              .platformRole
        )
        .map(
          (membership) => ({
            id:
              membership.user.id,

            membershipId:
              membership.id,

            name:
              membership.user.name,

            email:
              membership.user.email,

            phoneNumber:
              membership.user
                .phoneNumber,

            role:
              membership.role,

            permissions:
              membership.role === "OWNER"
                ? ["*"]
                : isRoleTemplate(membership.role)
                  ? getRoleTemplatePermissions(
                      membership.role
                    )
                  : membership.role === "CUSTOM"
                    ? membership.permissions ?? []
                    : [],

            membershipActive:
              membership.isActive,

            accountActive:
              membership.user
                .isActive,

            isDefault:
              membership.isDefault,

            joinedAt:
              membership.joinedAt,

            membershipUpdatedAt:
              membership.updatedAt,

            createdAt:
              membership.user
                .createdAt,
          })
        );

    return res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    console.error(
      "[USER MANAGEMENT] Get users error:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "USERS_FETCH_FAILED",
      message:
        "Failed to retrieve organization users.",
    });
  }
};

/* =========================================================
   INVITE ORGANIZATION USER

   POST /api/users

   SECURITY:
   - OWNER-only route boundary is enforced in user.routes.ts.
   - Tenant context comes from the authenticated session.
   - The invitation is created before any membership exists.
   - No tenant access is granted until the invitation is accepted.
   - The invitation token is never stored in plaintext.
   - Existing platform accounts cannot be invited.
   - Existing tenant memberships cannot be duplicated.
   - Existing pending invitations cannot be duplicated.
========================================================= */

export const addUser = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const context = getTenantContext(req);

    if (!context) {
      return res.status(403).json({
        success: false,
        code: "TENANT_SESSION_REQUIRED",
        message: "A tenant session is required.",
      });
    }

    const authorization = await requireTenantPermission(
      req,
      context.organizationId,
      "users.create"
    );

    if (!authorization.allowed) {
      return res.status(authorization.status).json({
        success: false,
        code: authorization.code,
        message: authorization.message,
      });
    }

    const name =
      typeof req.body?.name === "string"
        ? req.body.name.trim()
        : "";

    const email =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";

    const phoneNumber = normalizeInvitedPhone(
      req.body?.phoneNumber
    );

    const role = normalizeRole(req.body?.role);

    if (!name) {
      return res.status(400).json({
        success: false,
        code: "USER_NAME_REQUIRED",
        message: "User name is required.",
      });
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        code: "USER_EMAIL_REQUIRED",
        message: "User email is required.",
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_EMAIL",
        message: "A valid email address is required.",
      });
    }

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        code: "USER_PHONE_REQUIRED",
        message: "A valid Kenyan mobile phone number is required.",
      });
    }

    if (!role) {
      return res.status(400).json({
        success: false,
        code: "USER_ROLE_REQUIRED",
        message: "User role is required.",
      });
    }

    const permissionResolution = resolveRolePermissions(
      role,
      req.body?.permissions
    );

    if (!permissionResolution.success) {
      return res.status(400).json({
        success: false,
        code: permissionResolution.code,
        message: permissionResolution.message,
      });
    }

    const permissions = permissionResolution.permissions;

    if (
      !canGrantPermissions(
        authorization.role,
        authorization.permissions,
        permissions
      )
    ) {
      return res.status(403).json({
        success: false,
        code: "PERMISSION_ESCALATION_BLOCKED",
        message:
          "You cannot grant permissions you do not have yourself.",
      });
    }

    /*
     * Phone numbers are intentionally NOT globally unique.
     *
     * A Ziya identity may legitimately belong to more than one
     * organization, and legacy production data may already contain
     * the same phone number on multiple tenant identities.
     *
     * What must be unique is the phone identifier within the tenant
     * onboarding boundary. The organization-level invitation index
     * and the membership check below enforce that boundary without
     * breaking cross-tenant identities.
     */
    const existingUser =
      await prisma.user.findUnique({
        where: {
          email,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          isActive: true,
          platformRole: true,
        },
      });

    if (
      existingUser?.phoneNumber &&
      existingUser.phoneNumber !== phoneNumber
    ) {
      return res.status(409).json({
        success: false,
        code: "USER_PHONE_CONFLICT",
        message:
          "This user already has a different phone number. Update the existing account before sending an invitation with another number.",
      });
    }

    if (existingUser?.platformRole) {
      return res.status(409).json({
        success: false,
        code: "PLATFORM_ACCOUNT_RESTRICTED",
        message:
          "A platform administration account cannot be added to a tenant finance workspace.",
      });
    }

    if (existingUser && !existingUser.isActive) {
      return res.status(409).json({
        success: false,
        code: "USER_ACCOUNT_INACTIVE",
        message: "The existing user account is inactive.",
      });
    }

    if (existingUser) {
      const existingMembership =
        await prisma.organizationMember.findUnique({
          where: {
            userId_organizationId: {
              userId: existingUser.id,
              organizationId: context.organizationId,
            },
          },
          select: {
            id: true,
            isActive: true,
            role: true,
          },
        });

      if (existingMembership) {
        return res.status(409).json({
          success: false,
          code: "USER_ALREADY_EXISTS",
          message: existingMembership.isActive
            ? "This user already belongs to the organization."
            : "This user already has an organization membership. Restore or manage the existing membership instead.",
        });
      }
    }

    /*
     * Do not allow two different identities in the same tenant to
     * share the same phone number. This keeps phone login
     * deterministic for that organization while still allowing a
     * legitimate user identity to exist in multiple organizations.
     */
    const phoneMembership =
      await prisma.organizationMember.findFirst({
        where: {
          organizationId: context.organizationId,
          user: {
            phoneNumber,
          },
        },
        select: {
          id: true,
          userId: true,
          isActive: true,
        },
      });

    if (phoneMembership && phoneMembership.userId !== existingUser?.id) {
      return res.status(409).json({
        success: false,
        code: "PHONE_NUMBER_ALREADY_IN_ORGANIZATION",
        message:
          "This phone number is already assigned to another user in this organization.",
      });
    }

    const organization = await prisma.organization.findUnique({
      where: {
        id: context.organizationId,
      },
      select: {
        id: true,
        name: true,
        status: true,
      },
    });

    if (!organization) {
      return res.status(404).json({
        success: false,
        code: "ORGANIZATION_NOT_FOUND",
        message: "The organization could not be found.",
      });
    }

    if (organization.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        code: "ORGANIZATION_INACTIVE",
        message: "This organization is not active.",
      });
    }

    const existingInvitation =
      await prisma.organizationInvitation.findUnique({
        where: {
          organizationId_email: {
            organizationId: context.organizationId,
            email,
          },
        },
        select: {
          id: true,
          status: true,
          expiresAt: true,
          phoneNumber: true,
        },
      });

    const existingPhoneInvitation =
      await prisma.organizationInvitation.findUnique({
        where: {
          organizationId_phoneNumber: {
            organizationId: context.organizationId,
            phoneNumber,
          },
        },
        select: {
          id: true,
          email: true,
          status: true,
          expiresAt: true,
        },
      });

    const now = new Date();

    if (
      existingPhoneInvitation &&
      existingPhoneInvitation.email !== email &&
      existingPhoneInvitation.status === "PENDING" &&
      existingPhoneInvitation.expiresAt > now
    ) {
      return res.status(409).json({
        success: false,
        code: "PHONE_INVITATION_ALREADY_PENDING",
        message:
          "A pending invitation already exists for this phone number in this organization.",
      });
    }

    if (
      existingInvitation &&
      existingInvitation.status === "PENDING" &&
      existingInvitation.expiresAt > now
    ) {
      return res.status(409).json({
        success: false,
        code: "INVITATION_ALREADY_PENDING",
        message:
          "A pending invitation already exists for this email address.",
      });
    }

    /*
     * Generate a high-entropy raw token for the email link.
     *
     * Only the SHA-256 hash is persisted. If the database is
     * exposed, the invitation URL cannot be reconstructed from
     * the stored value.
     */
    const rawToken = crypto.randomBytes(48).toString("base64url");

    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const expiresAt = new Date(
      now.getTime() + 72 * 60 * 60 * 1000
    );

    const invitation = await prisma.$transaction(
      async (tx) => {
        if (existingInvitation) {
          return tx.organizationInvitation.update({
            where: {
              id: existingInvitation.id,
            },
            data: {
              role,
              permissions,
              phoneNumber,
              tokenHash,
              status: "PENDING",
              invitedByUserId: context.userId,
              expiresAt,
              acceptedAt: null,
              revokedAt: null,
            },
            select: {
              id: true,
              organizationId: true,
              email: true,
              phoneNumber: true,
              role: true,
              permissions: true,
              status: true,
              expiresAt: true,
              createdAt: true,
            },
          });
        }

        return tx.organizationInvitation.create({
          data: {
            organizationId: context.organizationId,
            email,
            phoneNumber,
            role,
            permissions,
            tokenHash,
            status: "PENDING",
            invitedByUserId: context.userId,
            expiresAt,
          },
          select: {
            id: true,
            organizationId: true,
            email: true,
            phoneNumber: true,
            role: true,
            permissions: true,
            status: true,
            expiresAt: true,
            createdAt: true,
          },
        });
      }
    );

    const configuredAppUrl =
      typeof process.env.APP_URL === "string"
        ? process.env.APP_URL.trim()
        : typeof process.env.FRONTEND_URL === "string"
          ? process.env.FRONTEND_URL.trim()
          : "";

    const forwardedHost = req.get("x-forwarded-host");
    const forwardedProto = req.get("x-forwarded-proto");
    const requestHost = forwardedHost || req.get("host");
    const requestProtocol =
      forwardedProto ||
      (req.secure ? "https" : "http");

    const appUrl = (
      configuredAppUrl ||
      (requestHost
        ? `${requestProtocol}://${requestHost}`
        : "https://ziya-fos-production.up.railway.app")
    ).replace(/\/$/, "");

    const invitationUrl =
      `${appUrl}/invite/${encodeURIComponent(rawToken)}`;

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeOrganization = escapeHtml(organization.name);
    const safePhone = escapeHtml(maskPhoneNumber(phoneNumber));

    const firstName = escapeHtml(
      name.split(/\s+/)[0] || name
    );

    const roleLabel =
      role === "CUSTOM"
        ? "Custom Role"
        : role
            .replace(/_/g, " ")
            .replace(/\b\w/g, (letter) =>
              letter.toUpperCase()
            );

    const safeRoleLabel = escapeHtml(roleLabel);
    const safeInvitationUrl =
      escapeHtml(invitationUrl);

    const invitationAccess = buildInvitationAccess(permissions);
    const modulesHtml = invitationAccess.modules.length
      ? invitationAccess.modules.map((module) => `<li style="margin:0 0 7px;color:#344054;">${escapeHtml(module)}</li>`).join("")
      : `<li style="margin:0;color:#667085;">No module access assigned</li>`;
    const actionsHtml = invitationAccess.actions.length
      ? invitationAccess.actions.map((action) => `<li style="margin:0 0 7px;color:#344054;">${escapeHtml(action)}</li>`).join("")
      : `<li style="margin:0;color:#667085;">No additional write or workflow actions assigned</li>`;

    const invitationHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're invited to ${safeOrganization}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f7;font-family:Arial,Helvetica,sans-serif;color:#20243A;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f6f7;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:#0D9488;padding:28px 32px;">
              <div style="font-size:24px;line-height:1.2;font-weight:700;color:#ffffff;">Ziya FOS</div>
              <div style="margin-top:7px;font-size:13px;line-height:1.5;color:rgba(255,255,255,0.78);">Financial Operating System</div>
            </td>
          </tr>

          <tr>
            <td style="padding:40px 32px;">
              <h1 style="margin:0 0 16px;font-size:27px;line-height:1.3;color:#20243A;">
                Welcome to Ziya FOS, ${firstName}
              </h1>

              <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#4b5563;">
                You have been invited to join <strong>${safeOrganization}</strong> on Ziya Financial Operating System.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;background:#f7faf9;border:1px solid #e7eeee;border-radius:12px;">
                <tr>
                  <td style="padding:20px;">
                    <div style="margin-bottom:7px;font-size:11px;line-height:1.4;font-weight:700;letter-spacing:1px;color:#6b7280;">
                      YOUR ROLE
                    </div>
                    <div style="font-size:16px;line-height:1.5;font-weight:700;color:#20243A;">
                      ${safeRoleLabel}
                    </div>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;background:#ffffff;border:1px solid #e7eeee;border-radius:12px;">
                <tr><td style="padding:20px;">
                  <div style="margin-bottom:8px;font-size:11px;font-weight:700;letter-spacing:1px;color:#6b7280;">YOUR WORKSPACE ACCESS</div>
                  <ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.55;">${modulesHtml}</ul>
                </td></tr>
                <tr><td style="padding:0 20px 20px;">
                  <div style="margin-bottom:8px;font-size:11px;font-weight:700;letter-spacing:1px;color:#6b7280;">ASSIGNED ACTIONS</div>
                  <ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.55;">${actionsHtml}</ul>
                </td></tr>
              </table>

              <p style="margin:0 0 24px;font-size:13px;line-height:1.7;color:#667085;">
                Your Ziya FOS workspace will enforce these permissions. You will not be able to access modules or actions outside this assignment.
              </p>

              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="border-radius:10px;background:#0D9488;">
                    <a href="${safeInvitationUrl}" style="display:inline-block;padding:14px 28px;border-radius:10px;font-size:15px;line-height:1;font-weight:700;color:#ffffff;text-decoration:none;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:28px 0 5px;font-size:13px;line-height:1.6;color:#6b7280;">
                Invitation email
              </p>

              <p style="margin:0;font-size:14px;line-height:1.6;font-weight:700;color:#20243A;">
                ${safeEmail}
              </p>

              <p style="margin:16px 0 5px;font-size:13px;line-height:1.6;color:#6b7280;">
                Invited phone number
              </p>

              <p style="margin:0;font-size:14px;line-height:1.6;font-weight:700;color:#20243A;">
                ${escapeHtml(phoneNumber)}
              </p>

              <p style="margin:24px 0 0;font-size:13px;line-height:1.7;color:#6b7280;">
                This invitation link expires in 72 hours and can only be used once.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px;border-top:1px solid #edf0f2;">
              <p style="margin:0;font-size:12px;line-height:1.7;color:#9ca3af;">
                This invitation was sent by ${safeOrganization} through Ziya FOS. If you were not expecting this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    let invitationSent = false;

    try {
      await sendEmail(
        email,
        `You're invited as ${roleLabel} to ${organization.name} on Ziya FOS`,
        invitationHtml
      );

      invitationSent = true;
    } catch (emailError) {
      console.error(
        "[USER MANAGEMENT] Failed to send invitation email:",
        emailError
      );

      /*
       * The invitation remains pending in the database so the
       * Owner can safely retry/resend it through the invitation
       * management flow. The raw token is intentionally not
       * returned in the API response.
       */
    }

    await writeTenantAudit(
      context.organizationId,
      context.userId,
      "USER_INVITED",
      "USER_MANAGEMENT",
      JSON.stringify({
        invitationId: invitation.id,
        email: invitation.email,
        phoneNumber: invitation.phoneNumber,
        role: invitation.role,
        invitationSent,
      })
    );

    return res.status(201).json({
      success: true,
      message: invitationSent
        ? "Invitation created and email sent successfully."
        : "Invitation created, but the invitation email could not be sent.",
      invitationSent,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        phoneNumber: invitation.phoneNumber,
        role: invitation.role,
        permissions: invitation.permissions,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
      },
    });
  } catch (error) {
    console.error(
      "[USER MANAGEMENT] Create invitation error:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "INVITATION_CREATE_FAILED",
      message:
        "Failed to create the organization invitation.",
    });
  }
};
/* =========================================================
   UPDATE USER ROLE / PERMISSIONS

   PATCH /api/users/:membershipId/access
========================================================= */

export const updateUserAccess =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const context =
        getTenantContext(req);

      if (!context) {
        return res.status(403).json({
          success: false,
          code:
            "TENANT_SESSION_REQUIRED",
          message:
            "A tenant session is required.",
        });
      }

      const authorization =
        await requireTenantPermission(
          req,
          context.organizationId,
          "users.manageAccess"
        );

      if (!authorization.allowed) {
        return res.status(
          authorization.status
        ).json({
          success: false,
          code: authorization.code,
          message: authorization.message,
        });
      }

      const membershipId =
        typeof req.params
          .membershipId ===
        "string"
          ? req.params.membershipId.trim()
          : "";

      if (!membershipId) {
        return res.status(400).json({
          success: false,
          code:
            "MEMBERSHIP_ID_REQUIRED",
          message:
            "Membership ID is required.",
        });
      }

      const role =
        normalizeRole(
          req.body?.role
        );

      if (!role) {
        return res.status(400).json({
          success: false,
          code:
            "USER_ROLE_REQUIRED",
          message:
            "User role is required.",
        });
      }

      const permissionResolution =
        resolveRolePermissions(
          role,
          req.body?.permissions
        );

      if (
        !permissionResolution.success
      ) {
        return res.status(400).json({
          success: false,
          code:
            permissionResolution.code,
          message:
            permissionResolution.message,
        });
      }

      /*
       * resolveRolePermissions() is authoritative here:
       * - standard roles receive the current role template;
       * - CUSTOM receives only validated explicit permissions.
       */
      const permissions =
        permissionResolution.permissions;

      if (
        !canGrantPermissions(
          authorization.role,
          authorization.permissions,
          permissions
        )
      ) {
        return res.status(403).json({
          success: false,
          code: "PERMISSION_ESCALATION_BLOCKED",
          message:
            "You cannot grant permissions you do not have yourself.",
        });
      }

      const membership =
        await prisma.organizationMember.findFirst(
          {
            where: {
              id: membershipId,
              organizationId:
                context.organizationId,
            },

            select: {
              id: true,
              userId: true,
              role: true,

              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  platformRole: true,
                },
              },
            },
          }
        );

      if (!membership) {
        return res.status(404).json({
          success: false,
          code:
            "USER_NOT_FOUND",
          message:
            "The requested user could not be found in this organization.",
        });
      }

      if (
        membership.userId ===
        context.userId
      ) {
        return res.status(403).json({
          success: false,
          code:
            "SELF_ACCESS_CHANGE_NOT_ALLOWED",
          message:
            "You cannot change your own organization role or permissions.",
        });
      }

      if (
        membership.role === "OWNER"
      ) {
        return res.status(403).json({
          success: false,
          code:
            "OWNER_PROTECTED",
          message:
            "The organization owner cannot be modified through normal user management.",
        });
      }

      if (
        membership.user.platformRole
      ) {
        return res.status(403).json({
          success: false,
          code:
            "PLATFORM_ACCOUNT_RESTRICTED",
          message:
            "Platform administration accounts cannot be managed here.",
        });
      }

      const updated =
        await prisma.organizationMember.update(
          {
            where: {
              id: membership.id,
            },

            data: {
              role,
              permissions,
            },

            select: {
              id: true,
              role: true,
              permissions: true,
              isActive: true,
              isDefault: true,
              joinedAt: true,
              updatedAt: true,
            },
          }
        );

      return res.status(200).json({
        success: true,
        message:
          "User access updated successfully.",

        membership: updated,
      });
    } catch (error) {
      console.error(
        "[USER MANAGEMENT] Update access error:",
        error
      );

      return res.status(500).json({
        success: false,
        code:
          "USER_ACCESS_UPDATE_FAILED",
        message:
          "Failed to update user access.",
      });
    }
  };

/* =========================================================
   ACTIVATE / DEACTIVATE ORGANIZATION ACCESS

   PATCH /api/users/:membershipId/status
========================================================= */

export const updateUserStatus =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const context =
        getTenantContext(req);

      if (!context) {
        return res.status(403).json({
          success: false,
          code:
            "TENANT_SESSION_REQUIRED",
          message:
            "A tenant session is required.",
        });
      }

      const authorization =
        await requireTenantPermission(
          req,
          context.organizationId,
          "users.manageStatus"
        );

      if (!authorization.allowed) {
        return res.status(
          authorization.status
        ).json({
          success: false,
          code: authorization.code,
          message: authorization.message,
        });
      }

      const membershipId =
        typeof req.params
          .membershipId ===
        "string"
          ? req.params.membershipId.trim()
          : "";

      if (!membershipId) {
        return res.status(400).json({
          success: false,
          code:
            "MEMBERSHIP_ID_REQUIRED",
          message:
            "Membership ID is required.",
        });
      }

      const isActive =
        req.body?.isActive;

      if (
        typeof isActive !==
        "boolean"
      ) {
        return res.status(400).json({
          success: false,
          code:
            "INVALID_STATUS",
          message:
            "isActive must be a boolean.",
        });
      }

      const membership =
        await prisma.organizationMember.findFirst(
          {
            where: {
              id: membershipId,
              organizationId:
                context.organizationId,
            },

            select: {
              id: true,
              userId: true,
              role: true,

              user: {
                select: {
                  id: true,
                  platformRole: true,
                },
              },
            },
          }
        );

      if (!membership) {
        return res.status(404).json({
          success: false,
          code:
            "USER_NOT_FOUND",
          message:
            "The requested user could not be found in this organization.",
        });
      }

      if (
        membership.role === "OWNER"
      ) {
        return res.status(403).json({
          success: false,
          code:
            "OWNER_PROTECTED",
          message:
            "The organization owner cannot be deactivated.",
        });
      }

      if (
        membership.user.platformRole
      ) {
        return res.status(403).json({
          success: false,
          code:
            "PLATFORM_ACCOUNT_RESTRICTED",
          message:
            "Platform administration accounts cannot be managed here.",
        });
      }

      if (
        membership.userId ===
        context.userId
      ) {
        return res.status(403).json({
          success: false,
          code:
            "SELF_STATUS_CHANGE_NOT_ALLOWED",
          message:
            "You cannot change your own organization access.",
        });
      }

      const updated =
        await prisma.organizationMember.update(
          {
            where: {
              id: membership.id,
            },

            data: {
              isActive,
            },

            select: {
              id: true,
              role: true,
              permissions: true,
              isActive: true,
              isDefault: true,
              joinedAt: true,
              updatedAt: true,
            },
          }
        );

      return res.status(200).json({
        success: true,

        message: isActive
          ? "User access activated successfully."
          : "User access deactivated successfully.",

        membership: updated,
      });
    } catch (error) {
      console.error(
        "[USER MANAGEMENT] Update status error:",
        error
      );

      return res.status(500).json({
        success: false,
        code:
          "USER_STATUS_UPDATE_FAILED",
        message:
          "Failed to update user status.",
      });
    }
  };

/* =========================================================
   DELETE ORGANIZATION USER

   DELETE /api/users/:membershipId

   Deletes ONLY the tenant membership.

   The global User identity is intentionally preserved.
   If access is needed again, the user can be added back
   and assigned a new role.
========================================================= */

export const deleteOrganizationUser =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const context =
        getTenantContext(req);

      if (!context) {
        return res.status(403).json({
          success: false,
          code:
            "TENANT_SESSION_REQUIRED",
          message:
            "A tenant session is required.",
        });
      }

      const authorization =
        await requireTenantPermission(
          req,
          context.organizationId,
          "users.delete"
        );

      if (!authorization.allowed) {
        return res.status(
          authorization.status
        ).json({
          success: false,
          code: authorization.code,
          message: authorization.message,
        });
      }

      const membershipId =
        typeof req.params
          .membershipId ===
        "string"
          ? req.params.membershipId.trim()
          : "";

      if (!membershipId) {
        return res.status(400).json({
          success: false,
          code:
            "MEMBERSHIP_ID_REQUIRED",
          message:
            "Membership ID is required.",
        });
      }

      const membership =
        await prisma.organizationMember.findFirst(
          {
            where: {
              id: membershipId,
              organizationId:
                context.organizationId,
            },

            select: {
              id: true,
              userId: true,
              role: true,
              isActive: true,

              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  isActive: true,
                  platformRole: true,
                },
              },
            },
          }
        );

      if (!membership) {
        return res.status(404).json({
          success: false,
          code:
            "USER_NOT_FOUND",
          message:
            "The requested user could not be found in this organization.",
        });
      }

      if (
        membership.role === "OWNER"
      ) {
        return res.status(403).json({
          success: false,
          code:
            "OWNER_PROTECTED",
          message:
            "The organization owner cannot be deleted.",
        });
      }

      if (
        membership.user.platformRole
      ) {
        return res.status(403).json({
          success: false,
          code:
            "PLATFORM_ACCOUNT_RESTRICTED",
          message:
            "Platform administration accounts cannot be deleted from an organization workspace.",
        });
      }

      if (
        membership.userId ===
        context.userId
      ) {
        return res.status(403).json({
          success: false,
          code:
            "SELF_DELETE_NOT_ALLOWED",
          message:
            "You cannot delete your own organization access.",
        });
      }

      await prisma.organizationMember.delete(
        {
          where: {
            id: membership.id,
          },
        }
      );

      console.info(
        "[USER MANAGEMENT] Organization membership deleted:",
        {
          membershipId:
            membership.id,

          userId:
            membership.userId,

          organizationId:
            context.organizationId,

          deletedBy:
            context.userId,
        }
      );

      return res.status(200).json({
        success: true,
        message:
          "User removed successfully.",
        membershipId:
          membership.id,
      });
    } catch (error) {
      console.error(
        "[USER MANAGEMENT] Delete user error:",
        error
      );

      return res.status(500).json({
        success: false,
        code:
          "USER_DELETE_ERROR",
        message:
          "Unable to remove the user. Please try again.",
      });
    }
  };
/* =========================================================
   BACKWARD-COMPATIBLE CONTROLLER EXPORT

   user.routes.ts currently imports `deleteUser`.
   The tenant-safe implementation is named
   `deleteOrganizationUser`.

   This alias preserves the existing route contract without
   duplicating or weakening the deletion implementation.
========================================================= */


/* =========================================================
   TENANT AUDIT HELPER
========================================================= */

async function writeTenantAudit(
  organizationId: string,
  userId: string,
  action: string,
  module: string,
  details: string
): Promise<void> {
  try {
    await prisma.auditTrail.create({
      data: {
        organizationId,
        user: userId,
        action,
        module,
        details,
      },
    });
  } catch (error) {
    console.error("[AUDIT] Failed to write tenant audit:", error);
  }
}
export const deleteUser = deleteOrganizationUser;
