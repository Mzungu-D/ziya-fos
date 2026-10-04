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

  const userId =
    req.user.userId?.trim();

  const organizationId =
    req.user.organizationId?.trim();

  if (!userId || !organizationId) {
    return null;
  }

  return {
    userId,
    organizationId,
  };
};

/* =========================================================
   TENANT MANAGEMENT AUTHORIZATION

   Tenant isolation answers:
     "Which organization?"

   This helper answers:
     "Is this user allowed to perform this action?"

   OWNER:
     Full authority within the current tenant.

   STANDARD ROLE:
     Permissions come from the current server-side role template.

   CUSTOM:
     Permissions come from the tenant membership.

   PLATFORM ACCOUNTS:
     Never treated as tenant users.
========================================================= */

async function requireTenantPermission(
  req: AuthRequest,
  organizationId: string,
  permission: string
):
  Promise<
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
  const userId =
    req.user?.userId?.trim();

  if (!userId) {
    return {
      allowed: false,
      status: 403,
      code:
        "TENANT_SESSION_REQUIRED",
      message:
        "A tenant session is required.",
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
      code:
        "TENANT_MEMBERSHIP_REQUIRED",
      message:
        "You do not have access to this organization.",
    };
  }

  if (
    !membership.isActive ||
    !membership.user.isActive
  ) {
    return {
      allowed: false,
      status: 403,
      code:
        "TENANT_ACCESS_DISABLED",
      message:
        "Your organization access is disabled.",
    };
  }

  if (membership.user.platformRole) {
    return {
      allowed: false,
      status: 403,
      code:
        "PLATFORM_ACCOUNT_RESTRICTED",
      message:
        "Platform administration accounts cannot use tenant user management.",
    };
  }

  const permissions =
    membership.role === "OWNER"
      ? ["*"]
      : isRoleTemplate(
          membership.role
        )
        ? getRoleTemplatePermissions(
            membership.role
          )
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
      code:
        "INSUFFICIENT_PERMISSION",
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
   PERMISSION ESCALATION PROTECTION
========================================================= */

function canGrantPermissions(
  actorRole: string,
  actorPermissions: string[],
  targetPermissions: string[]
): boolean {
  if (actorRole === "OWNER") {
    return true;
  }

  if (
    targetPermissions.includes("*")
  ) {
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

function escapeHtml(
  value: string
): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* =========================================================
   INVITATION ACCESS SUMMARY
========================================================= */

const PERMISSION_LABELS: Record<
  string,
  string
> = {
  account:
    "Chart of Accounts",

  accountsPayable:
    "Accounts Payable",

  accountsReceivable:
    "Accounts Receivable",

  bankAccount:
    "Cash & Banking",

  bankPayment:
    "Bank Payments",

  budget:
    "Budgeting",

  document:
    "Documents",

  expense:
    "Expenses",

  fraud:
    "Fraud Detection",

  investment:
    "Investments",

  invoice:
    "Invoicing",

  journal:
    "Journal Entries",

  ledger:
    "General Ledger",

  mpesa:
    "M-Pesa",

  portfolioCompany:
    "Portfolio Companies",

  reports:
    "Financial Reports",

  vendor:
    "Vendors",

  tax:
    "Tax Management",

  employee:
    "HR Management",

  payroll:
    "Payroll",

  procurement:
    "Procurement",

  asset:
    "Fixed Assets",

  assetAssignment:
    "Asset Assignments",

  approval:
    "Approvals",

  users:
    "User Management",

  security:
    "Security",
};

const ACTION_LABELS: Record<
  string,
  string
> = {
  create: "Create",
  update: "Update",
  delete: "Delete",
  approve: "Approve",
  payment: "Process Payments",
  post: "Post",
  reverse: "Reverse",
  file: "File",
  status: "Manage Status",
  manageAccess:
    "Manage Access",
  manageStatus:
    "Manage Status",
  revoke:
    "Revoke Sessions",
  analyze:
    "Analyze",
};

function getPermissionModule(
  permission: string
): string {
  const [module] =
    permission.split(".");

  return (
    PERMISSION_LABELS[module] ??
    module
  );
}

function getPermissionAction(
  permission: string
): string | null {
  const parts =
    permission.split(".");

  if (
    parts.length < 2 ||
    parts[1] === "view"
  ) {
    return null;
  }

  return (
    ACTION_LABELS[parts[1]] ??
    parts[1]
      .replace(
        /([a-z])([A-Z])/g,
        "$1 $2"
      )
      .replace(
        /\b\w/g,
        (letter) =>
          letter.toUpperCase()
      )
  );
}

function buildInvitationAccess(
  permissions: string[]
) {
  const unique =
    [...new Set(permissions)];

  return {
    modules: [
      ...new Set(
        unique
          .filter((permission) =>
            permission.endsWith(
              ".view"
            )
          )
          .map(
            getPermissionModule
          )
      ),
    ],

    actions: [
      ...new Set(
        unique
          .map((permission) => {
            const action =
              getPermissionAction(
                permission
              );

            return action
              ? `${getPermissionModule(
                  permission
                )} — ${action}`
              : null;
          })
          .filter(
            (
              value
            ): value is string =>
              Boolean(value)
          )
      ),
    ],
  };
}

/* =========================================================
   PHONE NORMALIZATION
========================================================= */

function maskPhoneNumber(
  phoneNumber: string
): string {
  if (
    phoneNumber.length <= 4
  ) {
    return "****";
  }

  return `${"*".repeat(
    Math.max(
      0,
      phoneNumber.length - 4
    )
  )}${phoneNumber.slice(-4)}`;
}

function normalizeInvitedPhone(
  value: unknown
): string | null {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const raw =
    value.trim();

  if (!raw) {
    return null;
  }

  try {
    return normalizeKenyanPhoneNumber(
      raw
    );
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
    value
      .trim()
      .toUpperCase();

  return role || null;
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
        .filter(Boolean)
    ),
  ];

  /*
   * Wildcard access belongs only to OWNER.
   */
  if (
    permissions.includes("*")
  ) {
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
      code:
        "OWNER_ROLE_RESTRICTED",
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
        code:
          "INVALID_PERMISSIONS",
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
    code:
      "INVALID_ROLE",
    message:
      "The selected organization role is not supported.",
  };
}

/* =========================================================
   GET ORGANIZATION USERS

   GET /api/users
========================================================= */

export const getUsers =
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
          "users.view"
        );

      if (!authorization.allowed) {
        return res
          .status(
            authorization.status
          )
          .json({
            success: false,
            code:
              authorization.code,
            message:
              authorization.message,
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
            (membership) => {
              const permissions =
                membership.role ===
                "OWNER"
                  ? ["*"]
                  : isRoleTemplate(
                      membership.role
                    )
                    ? getRoleTemplatePermissions(
                        membership.role
                      )
                    : membership.role ===
                        "CUSTOM"
                      ? membership.permissions ??
                        []
                      : [];

              return {
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

                permissions,

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
              };
            }
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
        code:
          "USERS_FETCH_FAILED",
        message:
          "Failed to retrieve organization users.",
      });
    }
  };

/* =========================================================
   PRODUCTION INVITATION URL
========================================================= */

function invitationAppUrl(): string {
  const configuredUrl =
    process.env.APP_URL?.trim() ||
    process.env.FRONTEND_URL?.trim();

  if (!configuredUrl) {
    throw new Error(
      "APP_URL or FRONTEND_URL must be configured for production invitation URLs."
    );
  }

  return configuredUrl.replace(
    /\/$/,
    ""
  );
}

/* =========================================================
   INVITATION ROLE LABEL
========================================================= */

function invitationRoleLabel(
  role: string
): string {
  return role === "CUSTOM"
    ? "Custom Role"
    : role
        .replace(/_/g, " ")
        .replace(
          /\b\w/g,
          (letter) =>
            letter.toUpperCase()
        );
}

/* =========================================================
   SEND INVITATION EMAIL

   SECURITY:
   - Raw token exists only in memory.
   - Raw token is never stored.
   - Raw token is never audited.
   - Database stores only SHA-256 tokenHash.
========================================================= */

async function sendManagedInvitationEmail(
  invitation: {
    id: string;
    email: string;
    phoneNumber:
      | string
      | null;
    role: string;
    permissions: string[];
    expiresAt: Date;
  },
  organizationName: string,
  rawToken: string
): Promise<void> {
  const invitationUrl =
    `${invitationAppUrl()}/invite/${encodeURIComponent(
      rawToken
    )}`;

  const access =
    buildInvitationAccess(
      invitation.permissions
    );

  const safeOrganization =
    escapeHtml(
      organizationName
    );

  const safeEmail =
    escapeHtml(
      invitation.email
    );

  const roleLabel =
    invitationRoleLabel(
      invitation.role
    );

  const modulesHtml =
    access.modules.length
      ? access.modules
          .map(
            (module) =>
              `<li style="margin:0 0 7px;color:#344054;">${escapeHtml(
                module
              )}</li>`
          )
          .join("")
      : `<li style="color:#667085;">No module access assigned</li>`;

  const actionsHtml =
    access.actions.length
      ? access.actions
          .map(
            (action) =>
              `<li style="margin:0 0 7px;color:#344054;">${escapeHtml(
                action
              )}</li>`
          )
          .join("")
      : `<li style="color:#667085;">No additional actions assigned</li>`;

  const invitationHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta
  name="viewport"
  content="width=device-width,initial-scale=1.0"
>
<title>Ziya FOS Invitation</title>
</head>

<body style="
margin:0;
padding:0;
background:#f4f6f7;
font-family:Arial,Helvetica,sans-serif;
color:#20243A;
">

<table
  width="100%"
  cellpadding="0"
  cellspacing="0"
  border="0"
  style="background:#f4f6f7;"
>

<tr>
<td align="center"
style="padding:40px 16px;">

<table
  width="100%"
  cellpadding="0"
  cellspacing="0"
  border="0"
  style="
    max-width:600px;
    background:#ffffff;
    border-radius:16px;
    overflow:hidden;
  "
>

<tr>
<td style="
background:#0D9488;
padding:28px 32px;
color:#ffffff;
">

<div style="
font-size:24px;
font-weight:700;
">
Ziya FOS
</div>

<div style="
margin-top:6px;
font-size:13px;
opacity:.85;
">
Financial Operating System
</div>

</td>
</tr>

<tr>
<td style="
padding:40px 32px;
">

<h1 style="
margin:0 0 16px;
font-size:27px;
line-height:1.3;
">
You're invited to Ziya FOS
</h1>

<p style="
margin:0 0 18px;
font-size:15px;
line-height:1.7;
color:#4b5563;
">
You have been invited to join
<strong>
${safeOrganization}
</strong>
on Ziya Financial Operating System.
</p>

<div style="
margin:24px 0;
padding:20px;
background:#f7faf9;
border:1px solid #e7eeee;
border-radius:12px;
">

<div style="
font-size:11px;
font-weight:700;
letter-spacing:1px;
color:#667085;
">
YOUR ROLE
</div>

<div style="
margin-top:7px;
font-size:17px;
font-weight:700;
color:#20243A;
">
${escapeHtml(roleLabel)}
</div>

</div>

<div style="
margin-bottom:24px;
padding:20px;
border:1px solid #e7eeee;
border-radius:12px;
">

<div style="
margin-bottom:8px;
font-size:11px;
font-weight:700;
letter-spacing:1px;
color:#667085;
">
WORKSPACE ACCESS
</div>

<ul style="
margin:0;
padding-left:20px;
font-size:14px;
line-height:1.6;
">
${modulesHtml}
</ul>

<div style="
margin-top:20px;
margin-bottom:8px;
font-size:11px;
font-weight:700;
letter-spacing:1px;
color:#667085;
">
ASSIGNED ACTIONS
</div>

<ul style="
margin:0;
padding-left:20px;
font-size:14px;
line-height:1.6;
">
${actionsHtml}
</ul>

</div>

<p style="
margin:0 0 24px;
font-size:13px;
line-height:1.7;
color:#667085;
">
Your Ziya FOS access is restricted to the
organization and permissions assigned in this invitation.
</p>

<table
  cellpadding="0"
  cellspacing="0"
  border="0"
>

<tr>
<td
  align="center"
  style="
    border-radius:10px;
    background:#0D9488;
  "
>

<a
href="${escapeHtml(invitationUrl)}"
style="
display:inline-block;
padding:14px 28px;
border-radius:10px;
font-size:15px;
font-weight:700;
color:#ffffff;
text-decoration:none;
"
>
Accept Invitation
</a>

</td>
</tr>

</table>

<p style="
margin:28px 0 0;
font-size:13px;
line-height:1.7;
color:#667085;
">
This invitation expires in
<strong>72 hours</strong>
and can only be used once.
</p>

<p style="
margin:16px 0 0;
font-size:12px;
line-height:1.7;
color:#98A2B3;
">
If you were not expecting this invitation,
you can safely ignore this email.
</p>

</td>
</tr>

<tr>
<td style="
padding:24px 32px;
border-top:1px solid #edf0f2;
">

<p style="
margin:0;
font-size:12px;
line-height:1.7;
color:#9ca3af;
">
This invitation was sent by
${safeOrganization}
through Ziya FOS.
</p>

</td>
</tr>

</table>

</td>
</tr>

</table>

</body>
</html>
`;

  await sendEmail(
    invitation.email,
    `You're invited to ${organizationName} on Ziya FOS`,
    invitationHtml
  );
}

/* =========================================================
   INVITE ORGANIZATION USER

   POST /api/users

   IMPORTANT:
   Creating an invitation does NOT create membership.
   Membership is created only after the public invitation
   acceptance process succeeds.
========================================================= */

export const addUser =
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
          "users.create"
        );

      if (!authorization.allowed) {
        return res
          .status(
            authorization.status
          )
          .json({
            success: false,
            code:
              authorization.code,
            message:
              authorization.message,
          });
      }

      const name =
        typeof req.body?.name ===
        "string"
          ? req.body.name.trim()
          : "";

      const email =
        typeof req.body?.email ===
        "string"
          ? req.body.email
              .trim()
              .toLowerCase()
          : "";

      const phoneNumber =
        normalizeInvitedPhone(
          req.body?.phoneNumber
        );

      const role =
        normalizeRole(
          req.body?.role
        );

      if (!name) {
        return res.status(400).json({
          success: false,
          code:
            "USER_NAME_REQUIRED",
          message:
            "User name is required.",
        });
      }

      if (!email) {
        return res.status(400).json({
          success: false,
          code:
            "USER_EMAIL_REQUIRED",
          message:
            "User email is required.",
        });
      }

      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          email
        )
      ) {
        return res.status(400).json({
          success: false,
          code:
            "INVALID_EMAIL",
          message:
            "A valid email address is required.",
        });
      }

      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          code:
            "USER_PHONE_REQUIRED",
          message:
            "A valid Kenyan mobile phone number is required.",
        });
      }

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
          code:
            "PERMISSION_ESCALATION_BLOCKED",
          message:
            "You cannot grant permissions you do not have yourself.",
        });
      }

      const organization =
        await prisma.organization.findUnique({
          where: {
            id:
              context.organizationId,
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
          code:
            "ORGANIZATION_NOT_FOUND",
          message:
            "The organization could not be found.",
        });
      }

      if (
        organization.status !==
        "ACTIVE"
      ) {
        return res.status(403).json({
          success: false,
          code:
            "ORGANIZATION_INACTIVE",
          message:
            "This organization is not active.",
        });
      }

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
        existingUser?.platformRole
      ) {
        return res.status(409).json({
          success: false,
          code:
            "PLATFORM_ACCOUNT_RESTRICTED",
          message:
            "A platform administration account cannot be added to a tenant workspace.",
        });
      }

      if (
        existingUser &&
        !existingUser.isActive
      ) {
        return res.status(409).json({
          success: false,
          code:
            "USER_ACCOUNT_INACTIVE",
          message:
            "The existing user account is inactive.",
        });
      }

      if (
        existingUser?.phoneNumber &&
        existingUser.phoneNumber !==
          phoneNumber
      ) {
        return res.status(409).json({
          success: false,
          code:
            "USER_PHONE_CONFLICT",
          message:
            "This user already has a different phone number.",
        });
      }

      if (existingUser) {
        const existingMembership =
          await prisma.organizationMember.findUnique({
            where: {
              userId_organizationId: {
                userId:
                  existingUser.id,
                organizationId:
                  context.organizationId,
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
            code:
              "USER_ALREADY_EXISTS",
            message:
              "This user already belongs to the organization.",
          });
        }
      }

      const phoneMembership =
        await prisma.organizationMember.findFirst({
          where: {
            organizationId:
              context.organizationId,

            user: {
              phoneNumber,
            },
          },

          select: {
            userId: true,
          },
        });

      if (
        phoneMembership &&
        phoneMembership.userId !==
          existingUser?.id
      ) {
        return res.status(409).json({
          success: false,
          code:
            "PHONE_NUMBER_ALREADY_IN_ORGANIZATION",
          message:
            "This phone number is already assigned to another user in this organization.",
        });
      }

      const existingInvitation =
        await prisma.organizationInvitation.findUnique({
          where: {
            organizationId_email: {
              organizationId:
                context.organizationId,
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
              organizationId:
                context.organizationId,
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

      const now =
        new Date();

      if (
        existingInvitation &&
        existingInvitation.status ===
          "PENDING" &&
        existingInvitation.expiresAt >
          now
      ) {
        return res.status(409).json({
          success: false,
          code:
            "INVITATION_ALREADY_PENDING",
          message:
            "A pending invitation already exists for this email address.",
        });
      }

      if (
        existingPhoneInvitation &&
        existingPhoneInvitation.email !==
          email &&
        existingPhoneInvitation.status ===
          "PENDING" &&
        existingPhoneInvitation.expiresAt >
          now
      ) {
        return res.status(409).json({
          success: false,
          code:
            "PHONE_INVITATION_ALREADY_PENDING",
          message:
            "A pending invitation already exists for this phone number.",
        });
      }

      const rawToken =
        crypto
          .randomBytes(48)
          .toString("base64url");

      const tokenHash =
        crypto
          .createHash("sha256")
          .update(rawToken)
          .digest("hex");

      const expiresAt =
        new Date(
          now.getTime() +
            72 * 60 * 60 * 1000
        );

      const invitation =
        await prisma.$transaction(
          async (tx) => {
            if (
              existingInvitation
            ) {
              return tx.organizationInvitation.update({
                where: {
                  id:
                    existingInvitation.id,
                },

                data: {
                  role,
                  permissions,
                  phoneNumber,
                  tokenHash,
                  status:
                    "PENDING",
                  invitedByUserId:
                    context.userId,
                  expiresAt,
                  acceptedAt:
                    null,
                  revokedAt:
                    null,
                },

                select: {
                  id: true,
                  organizationId:
                    true,
                  email: true,
                  phoneNumber:
                    true,
                  role: true,
                  permissions:
                    true,
                  status: true,
                  expiresAt:
                    true,
                  createdAt:
                    true,
                },
              });
            }

            return tx.organizationInvitation.create({
              data: {
                organizationId:
                  context.organizationId,
                email,
                phoneNumber,
                role,
                permissions,
                tokenHash,
                status:
                  "PENDING",
                invitedByUserId:
                  context.userId,
                expiresAt,
              },

              select: {
                id: true,
                organizationId:
                  true,
                email: true,
                phoneNumber:
                  true,
                role: true,
                permissions:
                  true,
                status: true,
                expiresAt:
                  true,
                createdAt:
                  true,
              },
            });
          }
        );

      let invitationSent =
        false;

      try {
        await sendManagedInvitationEmail(
          invitation,
          organization.name,
          rawToken
        );

        invitationSent =
          true;
      } catch (emailError) {
        console.error(
          "[USER MANAGEMENT] Failed to send invitation email:",
          emailError
        );
      }

      await writeTenantAudit(
        context.organizationId,
        context.userId,
        "USER_INVITED",
        "USER_MANAGEMENT",
        JSON.stringify({
          invitationId:
            invitation.id,
          email:
            invitation.email,
          phoneNumber:
            invitation.phoneNumber,
          role:
            invitation.role,
          invitationSent,
        })
      );

      return res.status(201).json({
        success: true,

        message:
          invitationSent
            ? "Invitation created and email sent successfully."
            : "Invitation created, but the invitation email could not be sent.",

        invitationSent,

        invitation: {
          id:
            invitation.id,

          email:
            invitation.email,

          phoneNumber:
            invitation.phoneNumber,

          role:
            invitation.role,

          permissions:
            invitation.permissions,

          status:
            invitation.status,

          expiresAt:
            invitation.expiresAt,

          createdAt:
            invitation.createdAt,
        },
      });
    } catch (error) {
      console.error(
        "[USER MANAGEMENT] Create invitation error:",
        error
      );

      return res.status(500).json({
        success: false,
        code:
          "INVITATION_CREATE_FAILED",
        message:
          "Failed to create the organization invitation.",
      });
    }
  };

/* =========================================================
   GET ORGANIZATION INVITATIONS

   GET /api/users/invitations
========================================================= */

export const getInvitations =
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
          "users.view"
        );

      if (!authorization.allowed) {
        return res
          .status(
            authorization.status
          )
          .json({
            success: false,
            code:
              authorization.code,
            message:
              authorization.message,
          });
      }

      const now =
        new Date();

      /*
       * Expiration is tenant-scoped.
       */
      await prisma.organizationInvitation.updateMany({
        where: {
          organizationId:
            context.organizationId,

          status:
            "PENDING",

          expiresAt: {
            lte: now,
          },
        },

        data: {
          status:
            "EXPIRED",
        },
      });

      const invitations =
        await prisma.organizationInvitation.findMany({
          where: {
            organizationId:
              context.organizationId,
          },

          orderBy: {
            createdAt:
              "desc",
          },

          select: {
            id: true,
            email: true,
            phoneNumber: true,
            role: true,
            permissions: true,
            status: true,
            expiresAt: true,
            acceptedAt: true,
            revokedAt: true,
            createdAt: true,
            updatedAt: true,
            invitedByUserId:
              true,
          },
        });

      const inviterIds = [
        ...new Set(
          invitations
            .map(
              (invitation) =>
                invitation.invitedByUserId
            )
            .filter(Boolean)
        ),
      ];

      const inviters =
        inviterIds.length
          ? await prisma.user.findMany({
              where: {
                id: {
                  in: inviterIds,
                },
              },

              select: {
                id: true,
                name: true,
                email: true,
              },
            })
          : [];

      const inviterMap =
        new Map(
          inviters.map(
            (user) => [
              user.id,
              user,
            ]
          )
        );

      const result =
        invitations.map(
          (invitation) => ({
            id:
              invitation.id,

            email:
              invitation.email,

            phoneNumber:
              invitation.phoneNumber,

            role:
              invitation.role,

            permissions:
              invitation.permissions,

            access:
              buildInvitationAccess(
                invitation.permissions
              ),

            status:
              invitation.status,

            expiresAt:
              invitation.expiresAt,

            acceptedAt:
              invitation.acceptedAt,

            revokedAt:
              invitation.revokedAt,

            createdAt:
              invitation.createdAt,

            updatedAt:
              invitation.updatedAt,

            invitedBy:
              inviterMap.get(
                invitation.invitedByUserId
              ) ?? null,
          })
        );

      return res.status(200).json({
        success: true,
        invitations:
          result,
      });
    } catch (error) {
      console.error(
        "[USER MANAGEMENT] Get invitations error:",
        error
      );

      return res.status(500).json({
        success: false,
        code:
          "INVITATIONS_FETCH_FAILED",
        message:
          "Failed to retrieve organization invitations.",
      });
    }
  };

/* =========================================================
   RESEND ORGANIZATION INVITATION

   POST /api/users/invitations/:invitationId/resend

   A resend:
   - remains tenant scoped
   - rotates the token
   - invalidates the old token
   - resets expiry
   - keeps the original access
   - never exposes the raw token
========================================================= */

export const resendInvitation =
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
          "users.create"
        );

      if (!authorization.allowed) {
        return res
          .status(
            authorization.status
          )
          .json({
            success: false,
            code:
              authorization.code,
            message:
              authorization.message,
          });
      }

      const invitationId =
        typeof req.params
          .invitationId ===
        "string"
          ? req.params.invitationId.trim()
          : "";

      if (!invitationId) {
        return res.status(400).json({
          success: false,
          code:
            "INVITATION_ID_REQUIRED",
          message:
            "Invitation ID is required.",
        });
      }

      const invitation =
        await prisma.organizationInvitation.findFirst({
          where: {
            id:
              invitationId,

            organizationId:
              context.organizationId,
          },

          select: {
            id: true,
            email: true,
            phoneNumber: true,
            role: true,
            permissions: true,
            status: true,
            expiresAt: true,
          },
        });

      if (!invitation) {
        return res.status(404).json({
          success: false,
          code:
            "INVITATION_NOT_FOUND",
          message:
            "The requested invitation could not be found in this organization.",
        });
      }

      if (
        invitation.status !==
          "PENDING" &&
        invitation.status !==
          "EXPIRED"
      ) {
        return res.status(409).json({
          success: false,
          code:
            "INVITATION_CANNOT_BE_RESENT",
          message:
            "Only pending or expired invitations can be resent.",
        });
      }

      const organization =
        await prisma.organization.findUnique({
          where: {
            id:
              context.organizationId,
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
          code:
            "ORGANIZATION_NOT_FOUND",
          message:
            "The organization could not be found.",
        });
      }

      if (
        organization.status !==
        "ACTIVE"
      ) {
        return res.status(403).json({
          success: false,
          code:
            "ORGANIZATION_INACTIVE",
          message:
            "This organization is not active.",
        });
      }

      const permissionResolution =
        resolveRolePermissions(
          invitation.role,
          invitation.permissions
        );

      if (
        !permissionResolution.success
      ) {
        return res.status(409).json({
          success: false,
          code:
            "INVITATION_ACCESS_INVALID",
          message:
            "This invitation contains invalid access settings and cannot be resent.",
        });
      }

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
          code:
            "PERMISSION_ESCALATION_BLOCKED",
          message:
            "You cannot resend an invitation containing permissions you do not have yourself.",
        });
      }

      const rawToken =
        crypto
          .randomBytes(48)
          .toString("base64url");

      const tokenHash =
        crypto
          .createHash("sha256")
          .update(rawToken)
          .digest("hex");

      const expiresAt =
        new Date(
          Date.now() +
            72 * 60 * 60 * 1000
        );

      const updatedInvitation =
        await prisma.organizationInvitation.update({
          where: {
            id:
              invitation.id,
          },

          data: {
            tokenHash,
            status:
              "PENDING",
            expiresAt,
            acceptedAt:
              null,
            revokedAt:
              null,
            permissions,
            invitedByUserId:
              context.userId,
          },

          select: {
            id: true,
            email: true,
            phoneNumber: true,
            role: true,
            permissions: true,
            status: true,
            expiresAt: true,
          },
        });

      let invitationSent =
        false;

      try {
        await sendManagedInvitationEmail(
          updatedInvitation,
          organization.name,
          rawToken
        );

        invitationSent =
          true;
      } catch (emailError) {
        console.error(
          "[USER MANAGEMENT] Failed to resend invitation email:",
          emailError
        );
      }

      await writeTenantAudit(
        context.organizationId,
        context.userId,
        "INVITATION_RESENT",
        "USER_MANAGEMENT",
        JSON.stringify({
          invitationId:
            updatedInvitation.id,

          email:
            updatedInvitation.email,

          phoneNumber:
            updatedInvitation.phoneNumber,

          role:
            updatedInvitation.role,

          invitationSent,
        })
      );

      return res.status(200).json({
        success: true,

        invitationSent,

        message:
          invitationSent
            ? "Invitation resent successfully."
            : "Invitation regenerated, but the email could not be delivered.",

        invitation: {
          id:
            updatedInvitation.id,

          email:
            updatedInvitation.email,

          phoneNumber:
            updatedInvitation.phoneNumber,

          role:
            updatedInvitation.role,

          permissions:
            updatedInvitation.permissions,

          status:
            updatedInvitation.status,

          expiresAt:
            updatedInvitation.expiresAt,
        },
      });
    } catch (error) {
      console.error(
        "[USER MANAGEMENT] Resend invitation error:",
        error
      );

      return res.status(500).json({
        success: false,
        code:
          "INVITATION_RESEND_FAILED",
        message:
          "Unable to resend the invitation.",
      });
    }
  };

/* =========================================================
   REVOKE ORGANIZATION INVITATION

   DELETE /api/users/invitations/:invitationId

   Revocation is a state change, not a physical delete.
   This preserves audit history.
========================================================= */

export const revokeInvitation =
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
          "users.create"
        );

      if (!authorization.allowed) {
        return res
          .status(
            authorization.status
          )
          .json({
            success: false,
            code:
              authorization.code,
            message:
              authorization.message,
          });
      }

      const invitationId =
        typeof req.params
          .invitationId ===
        "string"
          ? req.params.invitationId.trim()
          : "";

      if (!invitationId) {
        return res.status(400).json({
          success: false,
          code:
            "INVITATION_ID_REQUIRED",
          message:
            "Invitation ID is required.",
        });
      }

      const invitation =
        await prisma.organizationInvitation.findFirst({
          where: {
            id:
              invitationId,

            organizationId:
              context.organizationId,
          },

          select: {
            id: true,
            email: true,
            phoneNumber: true,
            role: true,
            status: true,
          },
        });

      if (!invitation) {
        return res.status(404).json({
          success: false,
          code:
            "INVITATION_NOT_FOUND",
          message:
            "The requested invitation could not be found in this organization.",
        });
      }

      if (
        invitation.status ===
        "ACCEPTED"
      ) {
        return res.status(409).json({
          success: false,
          code:
            "INVITATION_ALREADY_ACCEPTED",
          message:
            "An accepted invitation cannot be revoked.",
        });
      }

      if (
        invitation.status ===
        "REVOKED"
      ) {
        return res.status(409).json({
          success: false,
          code:
            "INVITATION_ALREADY_REVOKED",
          message:
            "This invitation has already been revoked.",
        });
      }

      const updated =
        await prisma.organizationInvitation.updateMany({
          where: {
            id:
              invitation.id,

            organizationId:
              context.organizationId,

            status: {
              in: [
                "PENDING",
                "EXPIRED",
              ],
            },
          },

          data: {
            status:
              "REVOKED",

            revokedAt:
              new Date(),
          },
        });

      if (
        updated.count !== 1
      ) {
        return res.status(409).json({
          success: false,
          code:
            "INVITATION_STATE_CHANGED",
          message:
            "The invitation changed state before it could be revoked.",
        });
      }

      await writeTenantAudit(
        context.organizationId,
        context.userId,
        "INVITATION_REVOKED",
        "USER_MANAGEMENT",
        JSON.stringify({
          invitationId:
            invitation.id,

          email:
            invitation.email,

          phoneNumber:
            invitation.phoneNumber,

          role:
            invitation.role,
        })
      );

      return res.status(200).json({
        success: true,
        message:
          "Invitation revoked successfully.",
        invitationId:
          invitation.id,
        status:
          "REVOKED",
      });
    } catch (error) {
      console.error(
        "[USER MANAGEMENT] Revoke invitation error:",
        error
      );

      return res.status(500).json({
        success: false,
        code:
          "INVITATION_REVOKE_FAILED",
        message:
          "Unable to revoke the invitation.",
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
        return res
          .status(
            authorization.status
          )
          .json({
            success: false,
            code:
              authorization.code,
            message:
              authorization.message,
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
          code:
            "PERMISSION_ESCALATION_BLOCKED",
          message:
            "You cannot grant permissions you do not have yourself.",
        });
      }

      const membership =
        await prisma.organizationMember.findFirst({
          where: {
            id:
              membershipId,

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
        });

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
        membership.role ===
        "OWNER"
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
        await prisma.organizationMember.update({
          where: {
            id:
              membership.id,
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
        });

      await writeTenantAudit(
        context.organizationId,
        context.userId,
        "USER_ACCESS_UPDATED",
        "USER_MANAGEMENT",
        JSON.stringify({
          membershipId:
            membership.id,
          targetUserId:
            membership.userId,
          role,
          permissions,
        })
      );

      return res.status(200).json({
        success: true,
        message:
          "User access updated successfully.",
        membership:
          updated,
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
        return res
          .status(
            authorization.status
          )
          .json({
            success: false,
            code:
              authorization.code,
            message:
              authorization.message,
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
        await prisma.organizationMember.findFirst({
          where: {
            id:
              membershipId,

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
        });

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
        membership.role ===
        "OWNER"
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
        await prisma.organizationMember.update({
          where: {
            id:
              membership.id,
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
        });

      await writeTenantAudit(
        context.organizationId,
        context.userId,
        isActive
          ? "USER_ACTIVATED"
          : "USER_DEACTIVATED",
        "USER_MANAGEMENT",
        JSON.stringify({
          membershipId:
            membership.id,
          targetUserId:
            membership.userId,
          isActive,
        })
      );

      return res.status(200).json({
        success: true,

        message:
          isActive
            ? "User access activated successfully."
            : "User access deactivated successfully.",

        membership:
          updated,
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

   IMPORTANT:
   Deletes ONLY the tenant membership.

   The global User identity remains intact.
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
        return res
          .status(
            authorization.status
          )
          .json({
            success: false,
            code:
              authorization.code,
            message:
              authorization.message,
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
        await prisma.organizationMember.findFirst({
          where: {
            id:
              membershipId,

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
        });

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
        membership.role ===
        "OWNER"
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

      await prisma.organizationMember.delete({
        where: {
          id:
            membership.id,
        },
      });

      await writeTenantAudit(
        context.organizationId,
        context.userId,
        "USER_REMOVED",
        "USER_MANAGEMENT",
        JSON.stringify({
          membershipId:
            membership.id,
          targetUserId:
            membership.userId,
          email:
            membership.user.email,
        })
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
    /*
     * Audit failure must not cause an otherwise successful
     * tenant operation to fail.
     */
    console.error(
      "[AUDIT] Failed to write tenant audit:",
      error
    );
  }
}

/* =========================================================
   BACKWARD-COMPATIBLE EXPORT
========================================================= */

export const deleteUser =
  deleteOrganizationUser;