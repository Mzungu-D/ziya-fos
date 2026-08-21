import { Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";

import prisma from "../config/prisma";
import { sendEmail } from "../config/mailer";
import { AuthRequest } from "../middleware/auth.middleware";

import {
  getRoleTemplatePermissions,
  isRoleTemplate,
} from "../config/roleTemplates";

/* =========================================================
   TENANT PERMISSION CATALOGUE

   These are the permissions currently supported by
   Ziya FOS.

   "*" remains reserved exclusively for OWNER.
========================================================= */

const VALID_PERMISSIONS = new Set<string>([
  /* Accounts */
  "account.create",
  "account.delete",
  "account.update",
  "account.view",

  /* Accounts Payable */
  "accountsPayable.approve",
  "accountsPayable.create",
  "accountsPayable.delete",
  "accountsPayable.payment",
  "accountsPayable.view",

  /* Accounts Receivable */
  "accountsReceivable.approve",
  "accountsReceivable.create",
  "accountsReceivable.delete",
  "accountsReceivable.payment",
  "accountsReceivable.update",
  "accountsReceivable.view",

  /* Bank Accounts */
  "bankAccount.create",
  "bankAccount.view",

  /* Bank Payments */
  "bankPayment.create",
  "bankPayment.view",

  /* Expenses */
  "expense.create",
  "expense.view",

  /* Investments */
  "investment.create",
  "investment.view",

  /* Invoices */
  "invoice.create",
  "invoice.view",

  /* Journals */
  "journal.approve",
  "journal.create",
  "journal.delete",
  "journal.post",
  "journal.reverse",
  "journal.update",
  "journal.view",

  /* Ledger */
  "ledger.view",

  /* M-Pesa */
  "mpesa.create",
  "mpesa.view",

  /* Portfolio Companies */
  "portfolioCompany.create",
  "portfolioCompany.delete",
  "portfolioCompany.update",
  "portfolioCompany.view",

  /* Reports */
  "reports.view",

  /* HR / Employees */
  "employee.create",
  "employee.update",
  "employee.view",

  /* Payroll */
  "payroll.create",
  "payroll.update",
  "payroll.view",

  /* Assets */
  "asset.create",
  "asset.update",
  "asset.delete",
  "asset.view",

  /* Asset Assignments */
  "assetAssignment.create",
  "assetAssignment.update",
  "assetAssignment.view",

  /* Tenant User Management */
  "users.view",
  "users.create",
  "users.manageAccess",
  "users.manageStatus",

  /* Vendors */
  "vendor.create",
  "vendor.delete",
  "vendor.status",
  "vendor.update",
  "vendor.view",
]);

/* =========================================================
   TYPES
========================================================= */

interface TenantContext {
  userId: string;
  organizationId: string;
}

/* =========================================================
   TENANT CONTEXT
========================================================= */

function getTenantContext(
  req: AuthRequest
): TenantContext | null {
  if (
    !req.user ||
    !req.user.userId ||
    !req.user.organizationId
  ) {
    return null;
  }

  const sessionType = (
    req.user as AuthRequest["user"] & {
      sessionType?: string;
    }
  )?.sessionType;

  if (
    sessionType &&
    sessionType !== "TENANT"
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
   NORMALIZATION HELPERS
========================================================= */

function normalizeString(
  value: unknown
): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalizeOptionalString(
  value: unknown
): string | undefined {
  const normalized =
    normalizeString(value);

  return normalized.length > 0
    ? normalized
    : undefined;
}

function normalizeEmail(
  value: unknown
): string {
  return normalizeString(value)
    .toLowerCase();
}

function normalizeRole(
  value: unknown
): string {
  return normalizeString(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
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
        .map((permission) =>
          permission.trim()
        )
        .filter(
          (permission) =>
            permission.length > 0
        )
    ),
  ];

  /*
   * Wildcard is reserved exclusively for OWNER.
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

   Standard role:
     permissions come from roleTemplates.ts

   CUSTOM:
     permissions come from request and are validated

   OWNER:
     rejected here and handled separately by the system
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

  /*
   * Standard Ziya FOS role template.
   *
   * Ignore client-supplied permissions and use the
   * server-controlled template.
   */
  if (isRoleTemplate(role)) {
    return {
      success: true,
      permissions:
        getRoleTemplatePermissions(
          role
        ),
    };
  }

  /*
   * CUSTOM is the only normal role allowed to supply
   * its own permission array.
   */
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

    const memberships =
      await prisma.organizationMember.findMany({
        where: {
          organizationId:
            context.organizationId,
        },

        select: {
          id: true,
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
              createdAt: true,
            },
          },
        },

        orderBy: {
          joinedAt: "asc",
        },
      });

    const users =
      memberships.map(
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

          isDefault:
            membership.isDefault,

          joinedAt:
            membership.joinedAt,

          membershipUpdatedAt:
            membership.updatedAt,

          accountActive:
            membership.user
              .isActive,

          createdAt:
            membership.user
              .createdAt,
        })
      );

    return res.status(200).json({
      success: true,

      organizationId:
        context.organizationId,

      users,
    });
  } catch (error) {
    console.error(
      "[USERS] Failed to fetch organization users:",
      error
    );

    return res.status(500).json({
      success: false,
      code:
        "USER_FETCH_FAILED",
      message:
        "Failed to fetch organization users.",
    });
  }
};

/* =========================================================
   ADD ORGANIZATION USER

   POST /api/users

   STANDARD ROLE:
   Server applies permissions from roleTemplates.ts.

   CUSTOM:
   Tenant administrator explicitly selects permissions.

   OWNER:
   Cannot be created through this endpoint.

   PLATFORM_ADMIN:
   Cannot be inserted into tenant finance workspace.
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

    const name =
      normalizeString(
        req.body?.name
      );

    const email =
      normalizeEmail(
        req.body?.email
      );

    const phoneNumber =
      normalizeOptionalString(
        req.body?.phoneNumber
      );

    const role =
      normalizeRole(
        req.body?.role
      );

    /* =====================================================
       BASIC VALIDATION
    ===================================================== */

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

    if (!role) {
      return res.status(400).json({
        success: false,
        code:
          "USER_ROLE_REQUIRED",
        message:
          "User role is required.",
      });
    }

    /* =====================================================
       RESOLVE ROLE + PERMISSIONS
    ===================================================== */

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

    /* =====================================================
       CHECK GLOBAL USER IDENTITY
    ===================================================== */

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

    /*
     * Platform identities remain completely outside
     * tenant financial workspaces.
     */
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

    /* =====================================================
       PREVENT DUPLICATE TENANT MEMBERSHIP
    ===================================================== */

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
          },
        });

      if (existingMembership) {
        return res.status(409).json({
          success: false,
          code:
            "MEMBERSHIP_EXISTS",
          message:
            "This user already belongs to the organization.",
        });
      }
    }

    /* =====================================================
       CREATE USER + MEMBERSHIP ATOMICALLY
    ===================================================== */

    const result =
      await prisma.$transaction(
        async (tx) => {
          let user =
            existingUser;

          if (!user) {
            /*
             * Password remains required by the current
             * User schema.
             *
             * Generate an unusable random credential.
             *
             * We never return or expose it.
             *
             * Email/phone OTP onboarding will replace
             * this compatibility mechanism later.
             */
            const randomSecret =
              crypto
                .randomBytes(48)
                .toString("hex");

            const passwordHash =
              await bcrypt.hash(
                randomSecret,
                12
              );

            user =
              await tx.user.create({
                data: {
                  name,
                  email,
                  phoneNumber,

                  password:
                    passwordHash,

                  /*
                   * Legacy compatibility only.
                   *
                   * Tenant authority comes from
                   * OrganizationMember.
                   */
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
          }

          const membership =
            await tx.organizationMember.create({
              data: {
                userId:
                  user.id,

                organizationId:
                  context.organizationId,

                role,

                permissions,

                isActive: true,

                /*
                 * Adding a user to another organization
                 * must not silently switch their default
                 * workspace.
                 */
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
            });

          return {
            user,
            membership,
          };
        }
      );

    /* =====================================================
       SEND PROFESSIONAL INVITATION EMAIL

       The new user does not receive a password.
       They sign in with their email address and receive
       a one-time verification code.

       Email delivery happens AFTER the database transaction
       succeeds so an SMTP failure cannot roll back a
       successfully created user and membership.
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
        /*
         * Invitation links use the configured public application URL
         * when one is explicitly provided.
         *
         * Otherwise, derive the public URL from the request. Railway
         * forwards the original host/protocol through these headers,
         * so the same code automatically follows a future custom domain.
         */
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
          normalizeString(
            process.env.APP_URL ||
            process.env.FRONTEND_URL
          );

        const appUrl =
          configuredAppUrl ||
          (requestHost
            ? `${requestProtocol}://${requestHost}`
            : "https://ziya-fos-production.up.railway.app");

        const safeAppUrl =
          appUrl.replace(/\/$/, "");

        const firstName =
          name.split(/\s+/)[0] || name;

        const roleLabel =
          role === "CUSTOM"
            ? "Custom Role"
            : role
                .replace(/_/g, " ")
                .replace(/\b\w/g, (letter) =>
                  letter.toUpperCase()
                );

        const invitationHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  />
  <title>You're invited to Ziya FOS</title>
</head>
<body
  style="
    margin:0;
    padding:0;
    background:#f4f6f7;
    font-family:Arial,Helvetica,sans-serif;
    color:#20243A;
  "
>
  <table
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    style="background:#f4f6f7;"
  >
    <tr>
      <td align="center" style="padding:40px 16px;">
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
            <td
              style="
                background:#0D9488;
                padding:28px 32px;
              "
            >
              <div
                style="
                  font-size:24px;
                  line-height:1.2;
                  font-weight:700;
                  color:#ffffff;
                "
              >
                Ziya FOS
              </div>

              <div
                style="
                  margin-top:7px;
                  font-size:13px;
                  line-height:1.5;
                  color:rgba(255,255,255,0.78);
                "
              >
                Financial Operating System
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:40px 32px;">
              <h1
                style="
                  margin:0 0 16px;
                  font-size:27px;
                  line-height:1.3;
                  color:#20243A;
                "
              >
                Welcome to Ziya FOS, ${firstName}
              </h1>

              <p
                style="
                  margin:0 0 18px;
                  font-size:15px;
                  line-height:1.7;
                  color:#4b5563;
                "
              >
                You have been invited to join
                <strong>${organization.name}</strong>
                on Ziya Financial Operating System.
              </p>

              <table
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
                style="
                  margin:24px 0;
                  background:#f7faf9;
                  border:1px solid #e7eeee;
                  border-radius:12px;
                "
              >
                <tr>
                  <td style="padding:20px;">
                    <div
                      style="
                        margin-bottom:7px;
                        font-size:11px;
                        line-height:1.4;
                        font-weight:700;
                        letter-spacing:1px;
                        color:#6b7280;
                      "
                    >
                      YOUR ROLE
                    </div>

                    <div
                      style="
                        font-size:16px;
                        line-height:1.5;
                        font-weight:700;
                        color:#20243A;
                      "
                    >
                      ${roleLabel}
                    </div>
                  </td>
                </tr>
              </table>

              <p
                style="
                  margin:0 0 24px;
                  font-size:15px;
                  line-height:1.7;
                  color:#4b5563;
                "
              >
                Your access to Ziya FOS is limited to the
                functions assigned to your role.
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
                      href="${safeAppUrl}/login"
                      style="
                        display:inline-block;
                        padding:14px 28px;
                        border-radius:10px;
                        font-size:15px;
                        line-height:1;
                        font-weight:700;
                        color:#ffffff;
                        text-decoration:none;
                      "
                    >
                      Sign in to Ziya FOS
                    </a>
                  </td>
                </tr>
              </table>

              <p
                style="
                  margin:28px 0 5px;
                  font-size:13px;
                  line-height:1.6;
                  color:#6b7280;
                "
              >
                Sign in using this email address:
              </p>

              <p
                style="
                  margin:0;
                  font-size:14px;
                  line-height:1.6;
                  font-weight:700;
                  color:#20243A;
                "
              >
                ${email}
              </p>

              <p
                style="
                  margin:24px 0 0;
                  font-size:13px;
                  line-height:1.7;
                  color:#6b7280;
                "
              >
                Ziya FOS will send a secure verification code
                to your email when you sign in. You do not
                need to create or remember a password.
              </p>
            </td>
          </tr>

          <tr>
            <td
              style="
                padding:24px 32px;
                border-top:1px solid #edf0f2;
              "
            >
              <p
                style="
                  margin:0;
                  font-size:12px;
                  line-height:1.7;
                  color:#9ca3af;
                "
              >
                This invitation was sent by
                ${organization.name} through Ziya FOS.
                If you were not expecting this invitation,
                you can safely ignore this email.
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
          email,
          `You're invited to ${organization.name} on Ziya FOS`,
          invitationHtml
        );

        invitationSent = true;
      }
    } catch (emailError) {
      console.error(
        "[USERS] Failed to send invitation email:",
        emailError
      );
    }

    return res.status(201).json({
      success: true,

      message:
        invitationSent
          ? "User added successfully and invitation email sent."
          : "User added successfully, but the invitation email could not be sent.",

      invitationSent,

      user: {
        id:
          result.user.id,

        name:
          result.user.name,

        email:
          result.user.email,

        phoneNumber:
          result.user.phoneNumber,

        isActive:
          result.user.isActive,
      },

      membership: {
        id:
          result.membership.id,

        role:
          result.membership.role,

        permissions:
          result.membership
            .permissions,

        isActive:
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
      "[USERS] Failed to add organization user:",
      error
    );

    return res.status(500).json({
      success: false,
      code:
        "USER_ADD_FAILED",
      message:
        "Failed to add organization user.",
    });
  }
};

/* =========================================================
   UPDATE USER ACCESS

   PATCH /api/users/:membershipId/access

   STANDARD ROLE:
   Server applies template permissions.

   CUSTOM:
   Explicit permissions are validated.

   OWNER:
   Protected.

   Tenant isolation:
   Membership must belong to authenticated organization.
========================================================= */

export const updateUserAccess = async (
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

    const membershipId =
      normalizeString(
        req.params.membershipId
      );

    const role =
      normalizeRole(
        req.body?.role
      );

    if (!membershipId) {
      return res.status(400).json({
        success: false,
        code:
          "MEMBERSHIP_ID_REQUIRED",
        message:
          "Membership ID is required.",
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

    /* =====================================================
       RESOLVE ROLE + PERMISSIONS
    ===================================================== */

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

    /* =====================================================
       TENANT-SCOPED MEMBERSHIP LOOKUP
    ===================================================== */

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
              platformRole: true,
            },
          },
        },
      });

    if (!membership) {
      return res.status(404).json({
        success: false,
        code:
          "MEMBERSHIP_NOT_FOUND",
        message:
          "Organization membership was not found.",
      });
    }

    /* =====================================================
       PROTECT OWNER
    ===================================================== */

    if (
      membership.role === "OWNER"
    ) {
      return res.status(403).json({
        success: false,
        code:
          "OWNER_ACCESS_PROTECTED",
        message:
          "OWNER access cannot be modified through this operation.",
      });
    }

    /*
     * Defensive protection.
     *
     * Platform accounts should never have tenant
     * memberships, but reject modification if legacy
     * data ever violates that invariant.
     */
    if (
      membership.user.platformRole
    ) {
      return res.status(403).json({
        success: false,
        code:
          "PLATFORM_ACCOUNT_RESTRICTED",
        message:
          "Platform administration accounts cannot receive tenant financial access.",
      });
    }

    /* =====================================================
       UPDATE ACCESS
    ===================================================== */

    const updatedMembership =
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

    return res.status(200).json({
      success: true,

      message:
        "User access updated successfully.",

      membership:
        updatedMembership,
    });
  } catch (error) {
    console.error(
      "[USERS] Failed to update user access:",
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
   UPDATE MEMBERSHIP STATUS

   PATCH /api/users/:membershipId/status

   IMPORTANT:

   This changes only the user's membership inside the
   current organization.

   It does NOT globally disable the User because the same
   identity may belong to another organization.

   OWNER remains protected.
========================================================= */

export const updateUserStatus = async (
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

    const membershipId =
      normalizeString(
        req.params.membershipId
      );

    const isActive =
      req.body?.isActive;

    if (!membershipId) {
      return res.status(400).json({
        success: false,
        code:
          "MEMBERSHIP_ID_REQUIRED",
        message:
          "Membership ID is required.",
      });
    }

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

    /* =====================================================
       TENANT-SCOPED MEMBERSHIP LOOKUP
    ===================================================== */

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
              platformRole: true,
            },
          },
        },
      });

    if (!membership) {
      return res.status(404).json({
        success: false,
        code:
          "MEMBERSHIP_NOT_FOUND",
        message:
          "Organization membership was not found.",
      });
    }

    /* =====================================================
       PROTECT OWNER
    ===================================================== */

    if (
      membership.role === "OWNER"
    ) {
      return res.status(403).json({
        success: false,
        code:
          "OWNER_ACCESS_PROTECTED",
        message:
          "The organization OWNER cannot be disabled through this operation.",
      });
    }

    /* =====================================================
       PROTECT PLATFORM IDENTITIES
    ===================================================== */

    if (
      membership.user.platformRole
    ) {
      return res.status(403).json({
        success: false,
        code:
          "PLATFORM_ACCOUNT_RESTRICTED",
        message:
          "Platform administration accounts cannot be managed through tenant user management.",
      });
    }

    /* =====================================================
       PREVENT SELF-DEACTIVATION
    ===================================================== */

    if (
      membership.userId ===
        context.userId &&
      isActive === false
    ) {
      return res.status(403).json({
        success: false,
        code:
          "SELF_DEACTIVATION_RESTRICTED",
        message:
          "You cannot disable your own current organization access.",
      });
    }

    /* =====================================================
       UPDATE TENANT MEMBERSHIP
    ===================================================== */

    const updatedMembership =
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
          updatedAt: true,
        },
      });

    return res.status(200).json({
      success: true,

      message:
        isActive
          ? "Organization access activated successfully."
          : "Organization access disabled successfully.",

      membership:
        updatedMembership,
    });
  } catch (error) {
    console.error(
      "[USERS] Failed to update membership status:",
      error
    );

    return res.status(500).json({
      success: false,
      code:
        "USER_STATUS_UPDATE_FAILED",
      message:
        "Failed to update organization access.",
    });
  }
};