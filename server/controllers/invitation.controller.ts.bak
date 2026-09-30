import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";

import prisma from "../config/prisma";
import {
  getRoleTemplatePermissions,
  isRoleTemplate,
} from "../config/roleTemplates";

const STANDARD_SESSION_DAYS = 1;
const STANDARD_SESSION_EXPIRY = "1d";

/* =========================================================
   JWT
========================================================= */

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();

  if (!secret) {
    throw new Error("JWT_SECRET is not configured.");
  }

  return secret;
}

/* =========================================================
   NORMALIZATION
========================================================= */

function normalizeEmail(value: unknown): string {
  return typeof value === "string"
    ? value.trim().toLowerCase()
    : "";
}

function normalizeName(value: unknown): string {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ")
    : "";
}

function normalizePhone(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const phone = value.trim();

  return phone.length > 0 ? phone : null;
}

/* =========================================================
   REQUEST METADATA
========================================================= */

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];

  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }

  if (Array.isArray(forwarded)) {
    return forwarded[0]?.trim() ?? "unknown";
  }

  return req.socket?.remoteAddress ?? "unknown";
}

/* =========================================================
   INVITATION TOKEN SECURITY
========================================================= */

function hashInvitationToken(token: string): string {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

/* =========================================================
   SESSION SECURITY
========================================================= */

function generateSessionToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

/* =========================================================
   STANDARDIZED INVITATION ERROR
========================================================= */

function invalidInvitation(
  res: Response,
  code: string,
  message: string,
  status = 400
) {
  return res.status(status).json({
    success: false,
    code,
    message,
  });
}

const INVITATION_PERMISSION_LABELS: Record<string, string> = {
  account: "Chart of Accounts", accountsPayable: "Accounts Payable", accountsReceivable: "Accounts Receivable",
  bankAccount: "Cash & Banking", bankPayment: "Bank Payments", budget: "Budgeting", document: "Documents",
  expense: "Expenses", fraud: "Fraud Detection", investment: "Investments", invoice: "Invoicing", journal: "Journal Entries",
  ledger: "General Ledger", mpesa: "M-Pesa", portfolioCompany: "Portfolio Companies", reports: "Financial Reports", vendor: "Vendors",
  tax: "Tax Management", employee: "HR Management", payroll: "Payroll", procurement: "Procurement", asset: "Fixed Assets",
  assetAssignment: "Asset Assignments", approval: "Approvals", users: "User Management", security: "Security Sessions",
};

function resolveInvitationPermissions(
  role: string,
  storedPermissions: unknown
): string[] | null {
  /*
   * OWNER is a protected organization role. It is intentionally
   * represented by the wildcard in the authenticated permission
   * context and is not stored as a normal permission list.
   */
  if (role === "OWNER") {
    return ["*"];
  }

  /*
   * Standard roles are server-controlled. Never trust the
   * permission snapshot stored on an invitation because the
   * role template may have changed after the invitation was sent.
   */
  if (isRoleTemplate(role)) {
    return getRoleTemplatePermissions(role);
  }

  /*
   * CUSTOM is the only role whose permissions come from the
   * invitation record.
   *
   * Fail closed if the stored value is malformed or contains
   * the OWNER wildcard.
   */
  if (role === "CUSTOM") {
    if (!Array.isArray(storedPermissions)) {
      return null;
    }

    const permissions = [
      ...new Set(
        storedPermissions
          .filter(
            (permission): permission is string =>
              typeof permission === "string"
          )
          .map((permission) => permission.trim())
          .filter((permission) => permission.length > 0)
      ),
    ];

    if (permissions.includes("*")) {
      return null;
    }

    return permissions;
  }

  return null;
}

function invitationAccess(permissions: string[]) {
  const unique = [...new Set(permissions ?? [])];
  return {
    modules: [
      ...new Set(
        unique
          .filter((p) => p.endsWith(".view"))
          .map(
            (p) =>
              INVITATION_PERMISSION_LABELS[p.split(".")[0]] ??
              p.split(".")[0]
          )
      ),
    ],
    actions: [
      ...new Set(
        unique
          .filter((p) => !p.endsWith(".view"))
          .map((p) => {
            const [module, action] = p.split(".");
            const moduleLabel =
              INVITATION_PERMISSION_LABELS[module] ?? module;
            const actionLabel = (action ?? "")
              .replace(/([a-z])([A-Z])/g, "$1 $2")
              .replace(/\b\w/g, (letter) => letter.toUpperCase());

            return `${moduleLabel} — ${actionLabel}`;
          })
      ),
    ],
  };
}

/* =========================================================
   GET INVITATION

   GET /api/invitations/:token

   PUBLIC ENDPOINT

   IMPORTANT:
   - Does not consume invitation.
   - Does not create user.
   - Does not create membership.
   - Does not expose invitation token.
   - Only returns safe onboarding information.
========================================================= */

export const getInvitation = async (
  req: Request,
  res: Response
) => {
  try {
    const rawToken =
      typeof req.params.token === "string"
        ? req.params.token.trim()
        : "";

    if (!rawToken) {
      return invalidInvitation(
        res,
        "INVITATION_TOKEN_REQUIRED",
        "Invitation token is required.",
        400
      );
    }

    /*
     * Never query the database using the raw token.
     * Only the SHA-256 hash is persisted.
     */
    const tokenHash = hashInvitationToken(rawToken);

    const invitation =
      await prisma.organizationInvitation.findUnique({
        where: {
          tokenHash,
        },

        select: {
          id: true,
          email: true,
          role: true,
          permissions: true,
          status: true,
          expiresAt: true,

          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
              status: true,
            },
          },
        },
      });

    if (!invitation) {
      return invalidInvitation(
        res,
        "INVITATION_NOT_FOUND",
        "This invitation is invalid or no longer available.",
        404
      );
    }

    if (invitation.status !== "PENDING") {
      return invalidInvitation(
        res,
        "INVITATION_NOT_AVAILABLE",
        "This invitation has already been used or is no longer active.",
        410
      );
    }

    /*
     * Expiry is checked server-side every time.
     */
    if (new Date() >= invitation.expiresAt) {
      await prisma.organizationInvitation.updateMany({
        where: {
          id: invitation.id,
          status: "PENDING",
        },

        data: {
          status: "EXPIRED",
        },
      });

      return invalidInvitation(
        res,
        "INVITATION_EXPIRED",
        "This invitation has expired. Please ask the company administrator to send a new invitation.",
        410
      );
    }

    if (invitation.organization.status !== "ACTIVE") {
      return invalidInvitation(
        res,
        "ORGANIZATION_UNAVAILABLE",
        "This organization is not currently available.",
        403
      );
    }

    const effectivePermissions = resolveInvitationPermissions(
      invitation.role,
      invitation.permissions
    );

    if (!effectivePermissions) {
      return invalidInvitation(
        res,
        "INVITATION_ACCESS_INVALID",
        "This invitation contains invalid access settings. Please ask the company administrator to send a new invitation.",
        400
      );
    }

    return res.status(200).json({
      success: true,

      invitation: {
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        access: invitationAccess(invitation.permissions ?? []),

        organization: {
          id: invitation.organization.id,
          name: invitation.organization.name,
          slug: invitation.organization.slug,
          logoUrl: invitation.organization.logoUrl,
        },
      },
    });
  } catch (error) {
    console.error(
      "[INVITATION] Failed to validate invitation:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "INVITATION_VALIDATION_ERROR",
      message: "Unable to validate the invitation.",
    });
  }
};

/* =========================================================
   ACCEPT INVITATION

   POST /api/invitations/:token/accept

   PUBLIC ENDPOINT

   SECURITY MODEL:

   1. Validate invitation token.
   2. Validate invitation status.
   3. Validate invitation expiry.
   4. Validate organization.
   5. Find existing account by invitation email.
   6. Prevent platform account onboarding.
   7. Prevent duplicate membership.
   8. Create or update user.
   9. Create/update membership using ONLY invitation
      role and permissions.
   10. Atomically consume invitation.
   11. Create authenticated session.
   12. Return tenant JWT + user + membership permissions.

   The invitation permissions are authoritative.

   The accepting user cannot choose their own:
   - role
   - permissions
   - organization
   - modules
========================================================= */

export const acceptInvitation = async (
  req: Request,
  res: Response
) => {
  try {
    const rawToken =
      typeof req.params.token === "string"
        ? req.params.token.trim()
        : "";

    const name = normalizeName(
      req.body?.name
    );

    const phoneNumber = normalizePhone(
      req.body?.phoneNumber
    );

    const password =
      typeof req.body?.password === "string"
        ? req.body.password
        : "";

    /* =====================================================
       BASIC VALIDATION
    ===================================================== */

    if (!rawToken) {
      return invalidInvitation(
        res,
        "INVITATION_TOKEN_REQUIRED",
        "Invitation token is required.",
        400
      );
    }

    if (name.length < 2) {
      return invalidInvitation(
        res,
        "NAME_REQUIRED",
        "Please provide your full name.",
        400
      );
    }

    if (name.length > 120) {
      return invalidInvitation(
        res,
        "NAME_TOO_LONG",
        "Your name is too long.",
        400
      );
    }

    if (password.length < 8) {
      return invalidInvitation(
        res,
        "PASSWORD_TOO_SHORT",
        "Password must contain at least 8 characters.",
        400
      );
    }

    /*
     * The invitation token is never stored or queried in plaintext.
     */
    const tokenHash = hashInvitationToken(
      rawToken
    );

    /* =====================================================
       ATOMIC ONBOARDING TRANSACTION
    ===================================================== */

    const result = await prisma.$transaction(
      async (tx) => {
        /* =================================================
           1. LOAD INVITATION
        ================================================= */

        const invitation =
          await tx.organizationInvitation.findUnique({
            where: {
              tokenHash,
            },

            select: {
              id: true,
              organizationId: true,
              email: true,
              role: true,
              permissions: true,
              status: true,
              expiresAt: true,

              organization: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  logoUrl: true,
                  status: true,
                },
              },
            },
          });

        if (!invitation) {
          throw new Error(
            "INVITATION_NOT_FOUND"
          );
        }

        /* =================================================
           2. INVITATION STATUS
        ================================================= */

        if (invitation.status !== "PENDING") {
          throw new Error(
            "INVITATION_NOT_AVAILABLE"
          );
        }

        /* =================================================
           3. INVITATION EXPIRY
        ================================================= */

        if (
          new Date() >=
          invitation.expiresAt
        ) {
          await tx.organizationInvitation.update({
            where: {
              id: invitation.id,
            },

            data: {
              status: "EXPIRED",
            },
          });

          throw new Error(
            "INVITATION_EXPIRED"
          );
        }

        /* =================================================
           4. ORGANIZATION STATUS
        ================================================= */

        if (
          invitation.organization.status !==
          "ACTIVE"
        ) {
          throw new Error(
            "ORGANIZATION_UNAVAILABLE"
          );
        }

        const email = normalizeEmail(
          invitation.email
        );

        if (!email) {
          throw new Error(
            "INVITATION_EMAIL_INVALID"
          );
        }

        /*
         * Resolve access inside the transaction from the server-side
         * role template or the validated CUSTOM permission list.
         *
         * This is deliberately done at acceptance time so a standard
         * role can never retain a stale permission snapshot from an
         * older role-template version.
         */
        const effectivePermissions =
          resolveInvitationPermissions(
            invitation.role,
            invitation.permissions
          );

        if (!effectivePermissions) {
          throw new Error(
            "INVITATION_ACCESS_INVALID"
          );
        }

        /* =================================================
           5. FIND EXISTING USER
        ================================================= */

        const existingUser =
          await tx.user.findUnique({
            where: {
              email,
            },

            select: {
              id: true,
              name: true,
              email: true,
              password: true,
              phoneNumber: true,
              phoneVerifiedAt: true,
              emailVerifiedAt: true,
              isActive: true,
              platformRole: true,
            },
          });

        /* =================================================
           6. PLATFORM ACCOUNTS ARE SEPARATE
        ================================================= */

        if (existingUser?.platformRole) {
          throw new Error(
            "PLATFORM_ACCOUNT_NOT_ALLOWED"
          );
        }

        /* =================================================
           7. DISABLED ACCOUNT
        ================================================= */

        if (
          existingUser &&
          !existingUser.isActive
        ) {
          throw new Error(
            "ACCOUNT_DISABLED"
          );
        }

        /* =================================================
           8. FIND EXISTING MEMBERSHIP
        ================================================= */

        let existingMembership:
          | {
              id: string;
              isActive: boolean;
              role: string;
            }
          | null = null;

        if (existingUser) {
          existingMembership =
            await tx.organizationMember.findUnique(
              {
                where: {
                  userId_organizationId: {
                    userId: existingUser.id,
                    organizationId:
                      invitation.organizationId,
                  },
                },

                select: {
                  id: true,
                  isActive: true,
                  role: true,
                },
              }
            );

          /*
           * A user already belonging to the organization
           * cannot use another invitation to silently replace
           * their access.
           *
           * OWNER is the one exception because platform-created
           * organizations may already contain an OWNER membership
           * that must be activated rather than duplicated.
           */
          if (
            existingMembership &&
            !(
              invitation.role === "OWNER" &&
              existingMembership.role === "OWNER"
            )
          ) {
            throw new Error(
              "MEMBERSHIP_EXISTS"
            );
          }
        }

        /* =================================================
           9. HASH PASSWORD
        ================================================= */

        const passwordHash =
          await bcrypt.hash(
            password,
            12
          );

        /* =================================================
           10. CREATE OR UPDATE USER
        ================================================= */

        const user =
          existingUser ??
          (await tx.user.create({
            data: {
              name,
              email,
              password: passwordHash,

              /*
               * Phone is optional.
               *
               * If supplied during invitation acceptance,
               * it becomes the account phone number and can
               * subsequently be used for phone authentication.
               */
              phoneNumber,

              /*
               * The invitation proves control of the email
               * address because the acceptance URL was sent
               * to that email.
               */
              emailVerifiedAt: new Date(),

              isActive: true,

              /*
               * Keep the user's base role synchronized with
               * the invitation role.
               *
               * OrganizationMember remains the authoritative
               * tenant access record.
               */
              role: invitation.role,
            },

            select: {
              id: true,
              name: true,
              email: true,
              phoneNumber: true,
            },
          }));

        /* =================================================
           11. UPDATE EXISTING USER
        ================================================= */

        if (existingUser) {
          await tx.user.update({
            where: {
              id: existingUser.id,
            },

            data: {
              name,
              password: passwordHash,

              ...(phoneNumber
                ? {
                    phoneNumber,
                  }
                : {}),

              emailVerifiedAt:
                existingUser.emailVerifiedAt ??
                new Date(),

              isActive: true,
            },
          });
        }

        /* =================================================
           12. CREATE / UPDATE ORGANIZATION MEMBERSHIP
        ================================================= */

        /*
         * IMPORTANT:
         *
         * The invited user does NOT get to choose permissions.
         *
         * The organization invitation created by the authorized
         * administrator is the source of truth.
         *
         * Therefore:
         *
         * role       = invitation.role
         * permissions = invitation.permissions
         */
        const membership =
          existingMembership
            ? await tx.organizationMember.update({
                where: {
                  id: existingMembership.id,
                },

                data: {
                  role: invitation.role,

                  permissions: effectivePermissions,

                  isActive: true,
                  isDefault: true,
                },

                select: {
                  id: true,
                  role: true,
                  permissions: true,
                  organizationId: true,
                },
              })
            : await tx.organizationMember.create({
                data: {
                  userId: user.id,

                  organizationId:
                    invitation.organizationId,

                  role: invitation.role,

                  permissions: effectivePermissions,

                  isActive: true,
                  isDefault: true,
                },

                select: {
                  id: true,
                  role: true,
                  permissions: true,
                  organizationId: true,
                },
              });

        /* =================================================
           13. CONSUME INVITATION ATOMICALLY
        ================================================= */

        /*
         * This conditional update is critical.
         *
         * Even if two requests somehow reach this transaction
         * with the same token, only one request can change the
         * invitation from PENDING to ACCEPTED.
         */
        const consumed =
          await tx.organizationInvitation.updateMany({
            where: {
              id: invitation.id,
              tokenHash,
              status: "PENDING",
            },

            data: {
              status: "ACCEPTED",
              acceptedAt: new Date(),
            },
          });

        if (consumed.count !== 1) {
          throw new Error(
            "INVITATION_ALREADY_CONSUMED"
          );
        }

        /* =================================================
           14. CLIENT INFORMATION
        ================================================= */

        const clientIp =
          getClientIp(req);

        const userAgent =
          typeof req.headers["user-agent"] ===
          "string"
            ? req.headers["user-agent"]
            : null;

        /* =================================================
           15. CREATE SESSION
        ================================================= */

        const sessionToken =
          generateSessionToken();

        const sessionExpiresAt =
          new Date(
            Date.now() +
              STANDARD_SESSION_DAYS *
                24 *
                60 *
                60 *
                1000
          );

        const session =
          await tx.session.create({
            data: {
              userId: user.id,

              /*
               * Session tokens are high-entropy random values.
               *
               * Existing project authentication uses the session
               * token in the authenticated JWT/session workflow.
               */
              token: sessionToken,

              expiresAt:
                sessionExpiresAt,

              rememberMe: false,

              ipAddress: clientIp,

              userAgent,

              isActive: true,
            },
          });

        /* =================================================
           16. RESET LOGIN SECURITY STATE
        ================================================= */

        await tx.user.update({
          where: {
            id: user.id,
          },

          data: {
            lastLoginAt: new Date(),
            lastLoginIp: clientIp,
            loginAttempts: 0,
            lockedUntil: null,
          },
        });

        /* =================================================
           17. RETURN TRANSACTION RESULT
        ================================================= */

        return {
          user: {
            id: user.id,
            name,
            email,
            phoneNumber:
              phoneNumber ??
              existingUser?.phoneNumber ??
              null,
          },

          membership,

          organization:
            invitation.organization,

          session,
        };
      }
    );

    /* =====================================================
       AUDIT LOG
    ===================================================== */

    /*
     * Audit failure must never undo a successful invitation
     * acceptance because the onboarding transaction has already
     * committed.
     */
    try {
      await prisma.auditTrail.create({
        data: {
          organizationId:
            result.membership.organizationId,

          user: result.user.id,

          action:
            "INVITATION_ACCEPTED",

          module:
            "USER_ACCESS",

          details: JSON.stringify({
            invitationAccepted: true,

            email:
              result.user.email,

            name:
              result.user.name,

            role:
              result.membership.role,

            permissions:
              result.membership.permissions,

            membershipId:
              result.membership.id,
          }),
        },
      });
    } catch (auditError) {
      console.error(
        "[AUDIT] Failed to record invitation acceptance:",
        auditError
      );
    }

    /* =====================================================
       TENANT JWT
    ===================================================== */

    const token = jwt.sign(
      {
        userId:
          result.user.id,

        sessionId:
          result.session.id,

        sessionType:
          "TENANT",

        rememberMe:
          false,

        organizationId:
          result.membership.organizationId,

        role:
          result.membership.role,
      },

      getJwtSecret(),

      {
        expiresIn:
          STANDARD_SESSION_EXPIRY,
      }
    );

    /* =====================================================
       SUCCESS RESPONSE
    ===================================================== */

    return res.status(200).json({
      success: true,

      message:
        "Invitation accepted successfully.",

      token,

      sessionType:
        "TENANT",

      /*
       * IMPORTANT:
       *
       * The frontend needs the membership permissions immediately
       * after accepting the invitation.
       *
       * This prevents a newly onboarded user from being treated as
       * an unrestricted user or having to wait for another request
       * before their module access becomes available.
       */
      user: {
        id:
          result.user.id,

        name:
          result.user.name,

        email:
          result.user.email,

        phoneNumber:
          result.user.phoneNumber,

        role:
          result.membership.role,

        organizationId:
          result.membership.organizationId,

        organizationRole:
          result.membership.role,

        permissions:
          result.membership.permissions ?? [],
      },

      organization: {
        id:
          result.organization.id,

        name:
          result.organization.name,

        slug:
          result.organization.slug,

        logoUrl:
          result.organization.logoUrl,
      },

      /*
       * Also expose the membership explicitly.
       *
       * This is useful for frontend session initialization and
       * future multi-organization workspace switching.
       */
      membership: {
        id:
          result.membership.id,

        organizationId:
          result.membership.organizationId,

        role:
          result.membership.role,

        permissions:
          result.membership.permissions ?? [],
      },
    });
  } catch (error) {
    const code =
      error instanceof Error
        ? error.message
        : "";

    /* =====================================================
       EXPECTED INVITATION ERRORS
    ===================================================== */

    if (
      code ===
      "INVITATION_NOT_FOUND"
    ) {
      return invalidInvitation(
        res,
        code,
        "This invitation is invalid or no longer available.",
        404
      );
    }

    if (
      code ===
      "INVITATION_NOT_AVAILABLE"
    ) {
      return invalidInvitation(
        res,
        code,
        "This invitation has already been used or is no longer active.",
        410
      );
    }

    if (
      code ===
      "INVITATION_EXPIRED"
    ) {
      return invalidInvitation(
        res,
        code,
        "This invitation has expired. Please ask the company administrator to send a new invitation.",
        410
      );
    }

    if (
      code ===
      "ORGANIZATION_UNAVAILABLE"
    ) {
      return invalidInvitation(
        res,
        code,
        "This organization is not currently available.",
        403
      );
    }

    if (
      code ===
      "INVITATION_EMAIL_INVALID"
    ) {
      return invalidInvitation(
        res,
        code,
        "The invitation does not contain a valid email address.",
        400
      );
    }

    if (
      code ===
      "INVITATION_ACCESS_INVALID"
    ) {
      return invalidInvitation(
        res,
        code,
        "This invitation contains invalid access settings. Please ask the company administrator to send a new invitation.",
        400
      );
    }

    if (
      code ===
      "PLATFORM_ACCOUNT_NOT_ALLOWED"
    ) {
      return invalidInvitation(
        res,
        code,
        "This account cannot be onboarded through a tenant invitation.",
        403
      );
    }

    if (
      code ===
      "ACCOUNT_DISABLED"
    ) {
      return invalidInvitation(
        res,
        code,
        "This account is currently disabled.",
        403
      );
    }

    if (
      code ===
      "MEMBERSHIP_EXISTS"
    ) {
      return invalidInvitation(
        res,
        code,
        "This user already belongs to this organization.",
        409
      );
    }

    if (
      code ===
      "INVITATION_ALREADY_CONSUMED"
    ) {
      return invalidInvitation(
        res,
        code,
        "This invitation has already been used.",
        409
      );
    }

    /* =====================================================
       UNEXPECTED ERROR
    ===================================================== */

    console.error(
      "[INVITATION] Acceptance failed:",
      error
    );

    return res.status(500).json({
      success: false,
      code:
        "INVITATION_ACCEPTANCE_ERROR",
      message:
        "Unable to complete the invitation.",
    });
  }
};