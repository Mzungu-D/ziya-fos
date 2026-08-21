import { Response } from "express";

import prisma from "../config/prisma";

import {
  AuthRequest,
} from "../middleware/auth.middleware";

/* =========================================================
   TENANT SETTINGS CONTROLLER

   SECURITY MODEL
   ---------------------------------------------------------
   - Tenant authentication is required.
   - Tenant organization comes from the authenticated session.
   - Client-supplied organizationId is never trusted.
   - Users can only access their authenticated organization.
   - Sessions are limited to the authenticated user.
   - Session tokens are never returned to the frontend.
   - Audit logs are limited to the authenticated organization.
   - Platform administration remains completely separate.
========================================================= */

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
   GET ORGANIZATION SETTINGS

   GET /api/settings/organization
========================================================= */

export const getOrganizationSettings =
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

      const membership =
        await prisma.organizationMember.findUnique({
          where: {
            userId_organizationId: {
              userId:
                context.userId,

              organizationId:
                context.organizationId,
            },
          },

          select: {
            id: true,
            role: true,
            permissions: true,
            isActive: true,
            isDefault: true,
            joinedAt: true,

            user: {
              select: {
                id: true,
                isActive: true,
                platformRole: true,
              },
            },

            organization: {
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
            },
          },
        });

      if (!membership) {
        return res.status(403).json({
          success: false,
          code:
            "ORGANIZATION_ACCESS_DENIED",
          message:
            "You do not have access to this organization.",
        });
      }

      if (
        !membership.user.isActive
      ) {
        return res.status(403).json({
          success: false,
          code:
            "ACCOUNT_DISABLED",
          message:
            "Your account has been disabled.",
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
            "Platform administration accounts cannot access tenant financial workspaces.",
        });
      }

      if (
        !membership.isActive
      ) {
        return res.status(403).json({
          success: false,
          code:
            "MEMBERSHIP_DISABLED",
          message:
            "Your access to this organization has been disabled.",
        });
      }

      if (
        membership.organization.status !==
        "ACTIVE"
      ) {
        return res.status(403).json({
          success: false,
          code:
            "ORGANIZATION_DISABLED",
          message:
            "This organization is not currently active.",
        });
      }

      return res.status(200).json({
        success: true,

        organization:
          membership.organization,

        membership: {
          id:
            membership.id,

          role:
            membership.role,

          permissions:
            membership.permissions ?? [],

          isDefault:
            membership.isDefault,

          joinedAt:
            membership.joinedAt,
        },
      });
    } catch (error) {
      console.error(
        "[TENANT SETTINGS] Organization load error:",
        error
      );

      return res.status(500).json({
        success: false,
        code:
          "ORGANIZATION_SETTINGS_LOAD_FAILED",
        message:
          "Unable to retrieve organization settings.",
      });
    }
  };

/* =========================================================
   UPDATE ORGANIZATION SETTINGS

   PATCH /api/settings/organization

   The client cannot modify:
   - organization ID
   - slug
   - status
   - membership
   - ownership
========================================================= */

export const updateOrganizationSettings =
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

      const membership =
        await prisma.organizationMember.findUnique({
          where: {
            userId_organizationId: {
              userId:
                context.userId,

              organizationId:
                context.organizationId,
            },
          },

          select: {
            role: true,
            isActive: true,

            user: {
              select: {
                isActive: true,
                platformRole: true,
              },
            },

            organization: {
              select: {
                status: true,
              },
            },
          },
        });

      if (!membership) {
        return res.status(403).json({
          success: false,
          code:
            "ORGANIZATION_ACCESS_DENIED",
          message:
            "You do not have access to this organization.",
        });
      }

      if (
        !membership.isActive ||
        !membership.user.isActive
      ) {
        return res.status(403).json({
          success: false,
          code:
            "ACCESS_DISABLED",
          message:
            "Your organization access is disabled.",
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
            "Platform administration accounts cannot modify tenant settings.",
        });
      }

      if (
        membership.organization.status !==
        "ACTIVE"
      ) {
        return res.status(403).json({
          success: false,
          code:
            "ORGANIZATION_DISABLED",
          message:
            "This organization is not currently active.",
        });
      }

      /*
       * Only OWNER and ADMIN can modify
       * organization-level settings.
       */
      if (
        membership.role !== "OWNER" &&
        membership.role !== "ADMIN"
      ) {
        return res.status(403).json({
          success: false,
          code:
            "ORGANIZATION_SETTINGS_PERMISSION_DENIED",
          message:
            "You do not have permission to modify organization settings.",
        });
      }

      const body =
        req.body ?? {};

      const {
        name,
        legalName,
        registrationNumber,
        taxNumber,
        email,
        phoneNumber,
        address,
        country,
        currency,
        logoUrl,
      } = body;

      /* =====================================================
         PRISMA-SAFE UPDATE OBJECT

         country and currency are NON-NULL fields in Prisma.
         Therefore they cannot be assigned null.
      ===================================================== */

      const data: {
        name?: string;
        legalName?: string | null;
        registrationNumber?: string | null;
        taxNumber?: string | null;
        email?: string | null;
        phoneNumber?: string | null;
        address?: string | null;
        country?: string;
        currency?: string;
        logoUrl?: string | null;
      } = {};

      /* =====================================================
         ORGANIZATION NAME
      ===================================================== */

      if (
        name !== undefined
      ) {
        if (
          typeof name !== "string" ||
          !name.trim()
        ) {
          return res.status(400).json({
            success: false,
            code:
              "INVALID_ORGANIZATION_NAME",
            message:
              "Organization name is required.",
          });
        }

        data.name =
          name.trim();
      }

      /* =====================================================
         COUNTRY

         Prisma field is non-nullable.
      ===================================================== */

      if (
        country !== undefined
      ) {
        if (
          typeof country !== "string" ||
          !country.trim()
        ) {
          return res.status(400).json({
            success: false,
            code:
              "INVALID_COUNTRY",
            message:
              "Country must be a valid value.",
          });
        }

        data.country =
          country.trim();
      }

      /* =====================================================
         CURRENCY

         Prisma field is non-nullable.
      ===================================================== */

      if (
        currency !== undefined
      ) {
        if (
          typeof currency !== "string" ||
          !currency.trim()
        ) {
          return res.status(400).json({
            success: false,
            code:
              "INVALID_CURRENCY",
            message:
              "Currency must be a valid value.",
          });
        }

        data.currency =
          currency.trim();
      }

      /* =====================================================
         NULLABLE ORGANIZATION FIELDS
      ===================================================== */

      const nullableFields = [
        "legalName",
        "registrationNumber",
        "taxNumber",
        "email",
        "phoneNumber",
        "address",
        "logoUrl",
      ] as const;

      for (
        const field of nullableFields
      ) {
        if (
          body[field] !== undefined
        ) {
          if (
            body[field] !== null &&
            typeof body[field] !==
              "string"
          ) {
            return res.status(400).json({
              success: false,
              code:
                "INVALID_SETTING_VALUE",
              message:
                `${field} must be a string or null.`,
            });
          }

          data[field] =
            body[field] === null
              ? null
              : body[field]
                    .trim() || null;
        }
      }

      /* =====================================================
         ENSURE SOMETHING WAS ACTUALLY CHANGED
      ===================================================== */

      if (
        Object.keys(data).length === 0
      ) {
        return res.status(400).json({
          success: false,
          code:
            "NO_CHANGES",
          message:
            "No organization changes were provided.",
        });
      }

      /* =====================================================
         UPDATE ONLY THE AUTHENTICATED ORGANIZATION
      ===================================================== */

      const organization =
        await prisma.organization.update({
          where: {
            id:
              context.organizationId,
          },

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
        });

      /* =====================================================
         AUDIT
      ===================================================== */

      await prisma.auditTrail.create({
        data: {
          user:
            context.userId,

          action:
            "UPDATE",

          module:
            "SETTINGS",

          details:
            "Organization settings updated.",

          organizationId:
            context.organizationId,
        },
      });

      return res.status(200).json({
        success: true,

        message:
          "Organization settings updated successfully.",

        organization,
      });
    } catch (error) {
      console.error(
        "[TENANT SETTINGS] Organization update error:",
        error
      );

      return res.status(500).json({
        success: false,
        code:
          "ORGANIZATION_SETTINGS_UPDATE_FAILED",
        message:
          "Unable to update organization settings.",
      });
    }
  };

/* =========================================================
   GET SECURITY SESSIONS

   GET /api/settings/security/sessions

   SECURITY:
   - Only active sessions belonging to users in the
     authenticated organization are returned.
   - Organization membership is verified from the database.
   - Platform accounts are excluded from tenant sessions.
   - Session tokens are NEVER returned.
   - User identity is returned as name/email so administrators
     can identify who is signed in without relying on a raw
     browser user-agent string.
========================================================= */

export const getSecuritySessions =
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

      const membership =
        await prisma.organizationMember.findUnique({
          where: {
            userId_organizationId: {
              userId:
                context.userId,
              organizationId:
                context.organizationId,
            },
          },
          select: {
            isActive: true,
            user: {
              select: {
                isActive: true,
                platformRole: true,
              },
            },
            organization: {
              select: {
                status: true,
              },
            },
          },
        });

      if (!membership) {
        return res.status(403).json({
          success: false,
          code:
            "ORGANIZATION_ACCESS_DENIED",
          message:
            "You do not have access to this organization.",
        });
      }

      if (
        !membership.isActive ||
        !membership.user.isActive
      ) {
        return res.status(403).json({
          success: false,
          code:
            "ACCESS_DISABLED",
          message:
            "Your organization access is disabled.",
        });
      }

      if (
        membership.organization.status !==
        "ACTIVE"
      ) {
        return res.status(403).json({
          success: false,
          code:
            "ORGANIZATION_DISABLED",
          message:
            "This organization is not currently active.",
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
            "Platform administration accounts cannot access tenant sessions.",
        });
      }

      /* =====================================================
         GET ACTIVE ORGANIZATION MEMBERS

         We deliberately resolve memberships first instead of
         relying on an unverified client-supplied organizationId.
      ===================================================== */

      const organizationMembers =
        await prisma.organizationMember.findMany({
          where: {
            organizationId:
              context.organizationId,
            isActive: true,
            user: {
              isActive: true,
              platformRole: null,
            },
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
        });

      const organizationUserIds =
        organizationMembers.map(
          (member) => member.user.id
        );

      if (
        organizationUserIds.length === 0
      ) {
        return res.status(200).json({
          success: true,
          sessions: [],
        });
      }

      const usersById =
        new Map(
          organizationMembers.map(
            (member) => [
              member.user.id,
              member.user,
            ]
          )
        );

      const sessions =
        await prisma.session.findMany({
          where: {
            userId: {
              in: organizationUserIds,
            },
            isActive: true,
            expiresAt: {
              gt: new Date(),
            },
          },
          select: {
            id: true,
            userId: true,
            createdAt: true,
            lastActiveAt: true,
            expiresAt: true,
            ipAddress: true,
            userAgent: true,
            isActive: true,
            rememberMe: true,
          },
          orderBy: {
            lastActiveAt:
              "desc",
          },
        });

      const sessionRecords =
        sessions.map((session) => {
          const user =
            usersById.get(
              session.userId
            );

          return {
            id: session.id,
            user: {
              id: user?.id ?? session.userId,
              name: user?.name ?? "Unknown user",
              email: user?.email ?? "",
            },
            createdAt:
              session.createdAt,
            lastActiveAt:
              session.lastActiveAt,
            expiresAt:
              session.expiresAt,
            ipAddress:
              session.ipAddress,
            userAgent:
              session.userAgent,
            isActive:
              session.isActive,
            rememberMe:
              session.rememberMe,
            current:
              session.userId ===
              context.userId,
          };
        });

      return res.status(200).json({
        success: true,
        sessions:
          sessionRecords,
      });
    } catch (error) {
      console.error(
        "[TENANT SETTINGS] Session load error:",
        error
      );

      return res.status(500).json({
        success: false,
        code:
          "SECURITY_SESSIONS_LOAD_FAILED",
        message:
          "Unable to retrieve active sessions.",
      });
    }
  };

/* =========================================================
   REVOKE ONE SESSION

   DELETE /api/settings/security/sessions/:sessionId

   SECURITY:
   - Session must belong to an active user in the
     authenticated organization.
   - Session token is never accepted from the client.
   - Cross-tenant session revocation is impossible.
   - The current session may be revoked only when the
     caller explicitly chooses it; the UI should normally
     prevent accidental self-revocation.
========================================================= */

export const revokeSecuritySession =
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

      const sessionId =
        typeof req.params.sessionId ===
        "string"
          ? req.params.sessionId.trim()
          : "";

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          code:
            "SESSION_ID_REQUIRED",
          message:
            "Session ID is required.",
        });
      }

      const membership =
        await prisma.organizationMember.findUnique({
          where: {
            userId_organizationId: {
              userId:
                context.userId,
              organizationId:
                context.organizationId,
            },
          },
          select: {
            isActive: true,
            user: {
              select: {
                isActive: true,
                platformRole: true,
              },
            },
            organization: {
              select: {
                status: true,
              },
            },
          },
        });

      if (!membership) {
        return res.status(403).json({
          success: false,
          code:
            "ORGANIZATION_ACCESS_DENIED",
          message:
            "You do not have access to this organization.",
        });
      }

      if (
        !membership.isActive ||
        !membership.user.isActive
      ) {
        return res.status(403).json({
          success: false,
          code:
            "ACCESS_DISABLED",
          message:
            "Your organization access is disabled.",
        });
      }

      if (
        membership.organization.status !==
        "ACTIVE"
      ) {
        return res.status(403).json({
          success: false,
          code:
            "ORGANIZATION_DISABLED",
          message:
            "This organization is not currently active.",
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
            "Platform administration accounts cannot manage tenant sessions.",
        });
      }

      /* =====================================================
         FIND TARGET SESSION

         The session is first located by ID only. Its owner is
         then checked against the authenticated organization.
         This prevents cross-tenant access.
      ===================================================== */

      const session =
        await prisma.session.findUnique({
          where: {
            id: sessionId,
          },
          select: {
            id: true,
            userId: true,
            isActive: true,
          },
        });

      if (!session) {
        return res.status(404).json({
          success: false,
          code:
            "SESSION_NOT_FOUND",
          message:
            "The requested session was not found.",
        });
      }

      if (!session.isActive) {
        return res.status(409).json({
          success: false,
          code:
            "SESSION_ALREADY_REVOKED",
          message:
            "The requested session is already inactive.",
        });
      }

      const targetMembership =
        await prisma.organizationMember.findUnique({
          where: {
            userId_organizationId: {
              userId:
                session.userId,
              organizationId:
                context.organizationId,
            },
          },
          select: {
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

      if (
        !targetMembership ||
        !targetMembership.isActive ||
        !targetMembership.user.isActive ||
        targetMembership.user.platformRole
      ) {
        return res.status(404).json({
          success: false,
          code:
            "SESSION_NOT_FOUND",
          message:
            "The requested session was not found in this organization.",
        });
      }

      await prisma.session.update({
        where: {
          id: session.id,
        },
        data: {
          isActive: false,
        },
      });

      await prisma.auditTrail.create({
        data: {
          user:
            context.userId,
          action:
            "REVOKE_SESSION",
          module:
            "SECURITY",
          details:
            `Session revoked for ${targetMembership.user.name} (${targetMembership.user.email}).`,
          organizationId:
            context.organizationId,
        },
      });

      return res.status(200).json({
        success: true,
        message:
          "Session revoked successfully.",
        revokedSessionId:
          session.id,
      });
    } catch (error) {
      console.error(
        "[TENANT SETTINGS] Session revoke error:",
        error
      );

      return res.status(500).json({
        success: false,
        code:
          "SESSION_REVOKE_FAILED",
        message:
          "Unable to revoke the session.",
      });
    }
  };

/* =========================================================
   REVOKE OTHER SESSIONS

   DELETE /api/settings/security/sessions

   The current session is preserved.

   This action is intentionally personal:
   - It revokes only other sessions belonging to the
     authenticated user.
   - It never signs other organization users out.
========================================================= */

export const revokeOtherSecuritySessions =
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
        req.headers.authorization;

      const token =
        authorization?.startsWith(
          "Bearer "
        )
          ? authorization
              .slice(7)
              .trim()
          : "";

      if (!token) {
        return res.status(401).json({
          success: false,
          code:
            "AUTH_TOKEN_REQUIRED",
          message:
            "Authentication token is required.",
        });
      }

      const membership =
        await prisma.organizationMember.findUnique({
          where: {
            userId_organizationId: {
              userId:
                context.userId,
              organizationId:
                context.organizationId,
            },
          },
          select: {
            isActive: true,
            user: {
              select: {
                isActive: true,
                platformRole: true,
              },
            },
            organization: {
              select: {
                status: true,
              },
            },
          },
        });

      if (!membership) {
        return res.status(403).json({
          success: false,
          code:
            "ORGANIZATION_ACCESS_DENIED",
          message:
            "You do not have access to this organization.",
        });
      }

      if (
        !membership.isActive ||
        !membership.user.isActive
      ) {
        return res.status(403).json({
          success: false,
          code:
            "ACCESS_DISABLED",
          message:
            "Your organization access is disabled.",
        });
      }

      if (
        membership.organization.status !==
        "ACTIVE"
      ) {
        return res.status(403).json({
          success: false,
          code:
            "ORGANIZATION_DISABLED",
          message:
            "This organization is not currently active.",
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
            "Platform administration accounts cannot manage tenant sessions.",
        });
      }

      const currentSession =
        await prisma.session.findUnique({
          where: {
            token,
          },
          select: {
            id: true,
            userId: true,
            isActive: true,
            expiresAt: true,
          },
        });

      if (
        !currentSession ||
        currentSession.userId !==
          context.userId ||
        !currentSession.isActive ||
        currentSession.expiresAt <=
          new Date()
      ) {
        return res.status(401).json({
          success: false,
          code:
            "SESSION_NOT_FOUND",
          message:
            "The current session could not be verified.",
        });
      }

      const result =
        await prisma.session.updateMany({
          where: {
            userId:
              context.userId,
            isActive: true,
            id: {
              not:
                currentSession.id,
            },
          },
          data: {
            isActive: false,
          },
        });

      await prisma.auditTrail.create({
        data: {
          user:
            context.userId,
          action:
            "REVOKE_OTHER_SESSIONS",
          module:
            "SECURITY",
          details:
            `${result.count} other session(s) were revoked.`,
          organizationId:
            context.organizationId,
        },
      });

      return res.status(200).json({
        success: true,
        message:
          result.count > 0
            ? `${result.count} other session(s) signed out successfully.`
            : "There were no other active sessions.",
        revokedCount:
          result.count,
      });
    } catch (error) {
      console.error(
        "[TENANT SETTINGS] Other sessions revoke error:",
        error
      );

      return res.status(500).json({
        success: false,
        code:
          "OTHER_SESSIONS_REVOKE_FAILED",
        message:
          "Unable to sign out other sessions.",
      });
    }
  };

/* =========================================================
   GET TENANT AUDIT LOG

   GET /api/settings/audit

   SECURITY:
   - Only the authenticated organization.
   - Maximum 100 recent records.
========================================================= */

export const getTenantAuditLogs =
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

      const membership =
        await prisma.organizationMember.findUnique({
          where: {
            userId_organizationId: {
              userId:
                context.userId,

              organizationId:
                context.organizationId,
            },
          },

          select: {
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
        return res.status(403).json({
          success: false,
          code:
            "ORGANIZATION_ACCESS_DENIED",
          message:
            "You do not have access to this organization.",
        });
      }

      if (
        !membership.isActive ||
        !membership.user.isActive
      ) {
        return res.status(403).json({
          success: false,
          code:
            "ACCESS_DISABLED",
          message:
            "Your organization access is disabled.",
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
            "Platform administration accounts cannot access tenant audit logs.",
        });
      }

      const auditLogs =
        await prisma.auditTrail.findMany({
          where: {
            organizationId:
              context.organizationId,
          },

          select: {
            id: true,
            user: true,
            action: true,
            module: true,
            details: true,
            createdAt: true,
          },

          orderBy: {
            createdAt:
              "desc",
          },

          take: 100,
        });

      return res.status(200).json({
        success: true,
        auditLogs,
      });
    } catch (error) {
      console.error(
        "[TENANT SETTINGS] Audit load error:",
        error
      );

      return res.status(500).json({
        success: false,
        code:
          "AUDIT_LOG_LOAD_FAILED",
        message:
          "Unable to retrieve the tenant audit log.",
      });
    }
  };