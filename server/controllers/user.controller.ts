


import { Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";

import prisma from "../config/prisma";
import { sendEmail } from "../config/mailer";

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

  const permissions =
    membership.permissions ?? [];

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
              membership.permissions ??
              [],

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
   ADD ORGANIZATION USER

   POST /api/users

   Creates the global user identity when necessary,
   creates the organization membership and applies the
   selected role permissions.

   Email invitation delivery is handled after the
   membership is created.
========================================================= */

export const addUser = async (
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
      return res.status(
        authorization.status
      ).json({
        success: false,
        code: authorization.code,
        message: authorization.message,
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
      typeof req.body?.phoneNumber ===
      "string"
        ? req.body.phoneNumber.trim()
        : null;

    const role =
      normalizeRole(
        req.body?.role
      );

    if (!name) {
      return res.status(400).json({
        success: false,
        code: "USER_NAME_REQUIRED",
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
        code: "PERMISSION_ESCALATION_BLOCKED",
        message:
          "You cannot grant permissions you do not have yourself.",
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
          "A platform administration account cannot be added to a tenant finance workspace.",
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

    if (existingUser) {
      const existingMembership =
        await prisma.organizationMember.findUnique(
          {
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
          }
        );

      if (existingMembership) {
        return res.status(409).json({
          success: false,
          code:
            "USER_ALREADY_EXISTS",
          message:
            existingMembership.isActive
              ? "This user already belongs to the organization."
              : "This user already has an organization membership. Restore or manage the existing membership instead.",
        });
      }
    }

    const result =
      await prisma.$transaction(
        async (tx) => {
          let userId =
            existingUser?.id;

          if (!userId) {
            const createdUser =
              await tx.user.create({
                data: {
                  name,
                  email,
                  phoneNumber,

                  /*
                   * The current User schema still requires a
                   * password field. OTP remains the actual
                   * onboarding mechanism; this random hash is
                   * never disclosed or used as a user password.
                   */
                  password: await bcrypt.hash(
                    crypto
                      .randomBytes(48)
                      .toString("hex"),
                    12
                  ),

                  role: "USER",
                  platformRole: null,
                  isActive: true,
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

            userId =
              createdUser.id;
          }

          const membership =
            await tx.organizationMember.create(
              {
                data: {
                  userId,
                  organizationId:
                    context.organizationId,
                  role,
                  permissions,
                  isActive: true,
                  isDefault: false,
                },

                select: {
                  id: true,
                  role: true,
                  permissions: true,
                  isActive: true,
                  isDefault: true,
                  joinedAt: true,
                },
              }
            );

          return {
            userId,
            membership,
          };
        }
      );

    /* =====================================================
       SEND PROFESSIONAL INVITATION EMAIL

       The invitation is sent only after the database
       transaction succeeds. The user signs in with the
       invited email and receives an OTP.
    ===================================================== */

    let invitationSent = false;

    try {
      const organization =
        await prisma.organization.findUnique({
          where: {
            id: context.organizationId,
          },
          select: {
            name: true,
          },
        });

      if (organization) {
        const forwardedHost =
          req.get("x-forwarded-host");

        const forwardedProto =
          req.get("x-forwarded-proto");

        const requestHost =
          forwardedHost || req.get("host");

        const requestProtocol =
          forwardedProto ||
          (req.secure ? "https" : "http");

        const configuredAppUrl =
          typeof process.env.APP_URL === "string"
            ? process.env.APP_URL.trim()
            : typeof process.env.FRONTEND_URL === "string"
              ? process.env.FRONTEND_URL.trim()
              : "";

        const appUrl =
          configuredAppUrl ||
          (requestHost
            ? `${requestProtocol}://${requestHost}`
            : "https://ziya-fos-production.up.railway.app");

        const safeAppUrl =
          appUrl.replace(/\/$/, "");

        const safeName =
          escapeHtml(name);

        const safeEmail =
          escapeHtml(email);

        const safeOrganization =
          escapeHtml(organization.name);

        const firstName =
          escapeHtml(
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

        const safeRoleLabel =
          escapeHtml(roleLabel);

        const invitationHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're invited to Ziya FOS</title>
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
              <h1 style="margin:0 0 16px;font-size:27px;line-height:1.3;color:#20243A;">Welcome to Ziya FOS, ${firstName}</h1>
              <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#4b5563;">
                You have been invited to join <strong>${safeOrganization}</strong> on Ziya Financial Operating System.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;background:#f7faf9;border:1px solid #e7eeee;border-radius:12px;">
                <tr>
                  <td style="padding:20px;">
                    <div style="margin-bottom:7px;font-size:11px;line-height:1.4;font-weight:700;letter-spacing:1px;color:#6b7280;">YOUR ROLE</div>
                    <div style="font-size:16px;line-height:1.5;font-weight:700;color:#20243A;">${safeRoleLabel}</div>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#4b5563;">Your access to Ziya FOS is limited to the functions assigned to your role.</p>
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="border-radius:10px;background:#0D9488;">
                    <a href="${safeAppUrl}/login" style="display:inline-block;padding:14px 28px;border-radius:10px;font-size:15px;line-height:1;font-weight:700;color:#ffffff;text-decoration:none;">Sign in to Ziya FOS</a>
                  </td>
                </tr>
              </table>
              <p style="margin:28px 0 5px;font-size:13px;line-height:1.6;color:#6b7280;">Sign in using this email address:</p>
              <p style="margin:0;font-size:14px;line-height:1.6;font-weight:700;color:#20243A;">${safeEmail}</p>
              <p style="margin:24px 0 0;font-size:13px;line-height:1.7;color:#6b7280;">Ziya FOS will send a secure verification code to your email when you sign in. You do not need to create or remember a password.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;border-top:1px solid #edf0f2;">
              <p style="margin:0;font-size:12px;line-height:1.7;color:#9ca3af;">This invitation was sent by ${safeOrganization} through Ziya FOS. If you were not expecting this invitation, you can safely ignore this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

        await sendEmail(
          email,
          `You're invited to ${organization.name} on Ziya FOS`,
          invitationHtml
        );

        invitationSent = true;
      }
    } catch (emailError) {
      console.error(
        "[USER MANAGEMENT] Failed to send invitation email:",
        emailError
      );
    }

    return res.status(201).json({
      success: true,

      message: invitationSent
        ? "User added successfully and invitation email sent."
        : "User added successfully, but the invitation email could not be sent.",

      invitationSent,

      user: {
        id:
          result.userId,

        membershipId:
          result.membership.id,

        name,
        email,
        phoneNumber,

        role:
          result.membership.role,

        permissions:
          result.membership
            .permissions ?? [],

        membershipActive:
          result.membership
            .isActive,

        isDefault:
          result.membership
            .isDefault,

        joinedAt:
          result.membership
            .joinedAt,
      },
    });
  } catch (error) {
    console.error(
      "[USER MANAGEMENT] Add user error:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "USER_CREATE_FAILED",
      message:
        "Failed to add the organization user.",
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

export const deleteUser = deleteOrganizationUser;