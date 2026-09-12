import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";

import prisma from "../config/prisma";

const STANDARD_SESSION_DAYS = 1;
const STANDARD_SESSION_EXPIRY = "1d";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();

  if (!secret) {
    throw new Error("JWT_SECRET is not configured.");
  }

  return secret;
}

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

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];

  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }

  return req.socket?.remoteAddress ?? "unknown";
}

function hashInvitationToken(token: string): string {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function generateSessionToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

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

/* =========================================================
   GET INVITATION

   GET /api/invitations/:token

   Public endpoint.

   This NEVER consumes the invitation.
   It only validates the token and returns safe
   organization/role information for the acceptance page.
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

    return res.status(200).json({
      success: true,
      invitation: {
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
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

   Public endpoint.

   The invitation is consumed atomically together with
   User + OrganizationMember creation.

   This prevents:
   - token reuse
   - duplicate memberships
   - partial onboarding
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

    const name = normalizeName(req.body?.name);
    const phoneNumber = normalizePhone(req.body?.phoneNumber);
    const password =
      typeof req.body?.password === "string"
        ? req.body.password
        : "";

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

    const tokenHash = hashInvitationToken(rawToken);

    const result = await prisma.$transaction(
      async (tx) => {
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
          throw new Error("INVITATION_NOT_FOUND");
        }

        if (invitation.status !== "PENDING") {
          throw new Error("INVITATION_NOT_AVAILABLE");
        }

        if (new Date() >= invitation.expiresAt) {
          await tx.organizationInvitation.update({
            where: {
              id: invitation.id,
            },
            data: {
              status: "EXPIRED",
            },
          });

          throw new Error("INVITATION_EXPIRED");
        }

        if (invitation.organization.status !== "ACTIVE") {
          throw new Error("ORGANIZATION_UNAVAILABLE");
        }

        const email = normalizeEmail(invitation.email);

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

        if (existingUser?.platformRole) {
          throw new Error("PLATFORM_ACCOUNT_NOT_ALLOWED");
        }

        if (existingUser && !existingUser.isActive) {
          throw new Error("ACCOUNT_DISABLED");
        }

        let existingMembership:
          | {
              id: string;
              isActive: boolean;
              role: string;
            }
          | null = null;

        if (existingUser) {
          existingMembership =
            await tx.organizationMember.findUnique({
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
            });

          /*
           * Platform-created organizations already contain
           * the OWNER membership before the invitation is
           * accepted. That membership must be activated,
           * not duplicated.
           *
           * For every other invitation, an existing membership
           * remains a conflict.
           */
          if (
            existingMembership &&
            !(
              invitation.role === "OWNER" &&
              existingMembership.role === "OWNER"
            )
          ) {
            throw new Error("MEMBERSHIP_EXISTS");
          }
        }

        const passwordHash =
          await bcrypt.hash(password, 12);

        const user =
          existingUser ??
          (await tx.user.create({
            data: {
              name,
              email,
              password: passwordHash,
              phoneNumber,
              emailVerifiedAt: new Date(),
              isActive: true,
              role: invitation.role,
            },
            select: {
              id: true,
              name: true,
              email: true,
              phoneNumber: true,
            },
          }));

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

        const membership =
          existingMembership
            ? await tx.organizationMember.update({
                where: {
                  id: existingMembership.id,
                },
                data: {
                  role: invitation.role,
                  permissions:
                    invitation.permissions,
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
                  permissions:
                    invitation.permissions,
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

        /*
         * Ensure the invitation can only be consumed once.
         *
         * The status condition is checked again here.
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
          throw new Error("INVITATION_ALREADY_CONSUMED");
        }

        const clientIp =
          getClientIp(req);

        const userAgent =
          req.headers["user-agent"] ?? null;

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
              token: sessionToken,
              expiresAt: sessionExpiresAt,
              rememberMe: false,
              ipAddress: clientIp,
              userAgent,
              isActive: true,
            },
          });

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

    /*
     * Invitation acceptance is a tenant security event.
     * Record it after the onboarding transaction has committed.
     * Audit failure must never invalidate a successful acceptance.
     */
    try {
      await prisma.auditTrail.create({
        data: {
          organizationId:
            result.membership.organizationId,
          user: result.user.id,
          action: "INVITATION_ACCEPTED",
          module: "USER_ACCESS",
          details: JSON.stringify({
            invitationAccepted: true,
            email: result.user.email,
            name: result.user.name,
            role: result.membership.role,
            membershipId: result.membership.id,
          }),
        },
      });
    } catch (auditError) {
      console.error(
        "[AUDIT] Failed to record invitation acceptance:",
        auditError
      );
    }
    const token = jwt.sign(
      {
        userId: result.user.id,
        sessionId: result.session.id,
        sessionType: "TENANT",
        rememberMe: false,
        organizationId:
          result.membership.organizationId,
        role: result.membership.role,
      },
      getJwtSecret(),
      {
        expiresIn:
          STANDARD_SESSION_EXPIRY,
      }
    );

    return res.status(200).json({
      success: true,
      message:
        "Invitation accepted successfully.",
      token,
      sessionType: "TENANT",
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        phoneNumber:
          result.user.phoneNumber,
        role: result.membership.role,
      },
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        slug: result.organization.slug,
        logoUrl: result.organization.logoUrl,
      },
    });
  } catch (error) {
    const code =
      error instanceof Error
        ? error.message
        : "";

    if (code === "INVITATION_NOT_FOUND") {
      return invalidInvitation(
        res,
        code,
        "This invitation is invalid or no longer available.",
        404
      );
    }

    if (code === "INVITATION_NOT_AVAILABLE") {
      return invalidInvitation(
        res,
        code,
        "This invitation has already been used or is no longer active.",
        410
      );
    }

    if (code === "INVITATION_EXPIRED") {
      return invalidInvitation(
        res,
        code,
        "This invitation has expired. Please ask the company administrator to send a new invitation.",
        410
      );
    }

    if (code === "ORGANIZATION_UNAVAILABLE") {
      return invalidInvitation(
        res,
        code,
        "This organization is not currently available.",
        403
      );
    }

    if (code === "PLATFORM_ACCOUNT_NOT_ALLOWED") {
      return invalidInvitation(
        res,
        code,
        "This account cannot be onboarded through a tenant invitation.",
        403
      );
    }

    if (code === "ACCOUNT_DISABLED") {
      return invalidInvitation(
        res,
        code,
        "This account is currently disabled.",
        403
      );
    }

    if (code === "MEMBERSHIP_EXISTS") {
      return invalidInvitation(
        res,
        code,
        "This user already belongs to this organization.",
        409
      );
    }

    if (code === "INVITATION_ALREADY_CONSUMED") {
      return invalidInvitation(
        res,
        code,
        "This invitation has already been used.",
        409
      );
    }

    console.error(
      "[INVITATION] Acceptance failed:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "INVITATION_ACCEPTANCE_ERROR",
      message:
        "Unable to complete the invitation.",
    });
  }
};

