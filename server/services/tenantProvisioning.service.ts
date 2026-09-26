import { Prisma, PrismaClient } from "@prisma/client";

import {
  ensureStandardChartOfAccounts,
} from "./chartOfAccounts.service";

import {
  getRoleTemplatePermissions,
  isRoleTemplate,
} from "../config/roleTemplates";

export type TenantProvisioningDb =
  | Prisma.TransactionClient
  | PrismaClient;

export interface TenantBaselineResult {
  organizationId: string;
  chartOfAccounts: {
    createdCount: number;
    totalStandardAccounts: number;
  };
  membershipsSynchronized: number;
}

/**
 * Applies the same baseline workflow to every tenant.
 *
 * IMPORTANT:
 * - organizationId is the only tenant-specific boundary.
 * - OWNER always receives ["*"].
 * - Standard roles always receive the current server-side role template.
 * - CUSTOM permissions are preserved and are never expanded automatically.
 * - No tenant name, slug, email, or other tenant-specific condition is used.
 *
 * This function is safe to run repeatedly.
 */
export async function ensureTenantBaseline(
  db: TenantProvisioningDb,
  organizationId: string
): Promise<TenantBaselineResult> {
  const normalizedOrganizationId = organizationId?.trim();

  if (!normalizedOrganizationId) {
    throw new Error(
      "Organization context is required to initialize the tenant baseline."
    );
  }

  const organization = await db.organization.findUnique({
    where: {
      id: normalizedOrganizationId,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!organization) {
    throw new Error(
      `Organization ${normalizedOrganizationId} was not found.`
    );
  }

  const chartOfAccounts =
    await ensureStandardChartOfAccounts(
      db,
      normalizedOrganizationId
    );

  const memberships =
    await db.organizationMember.findMany({
      where: {
        organizationId: normalizedOrganizationId,
      },
      select: {
        id: true,
        role: true,
        permissions: true,
        isActive: true,
      },
    });

  let membershipsSynchronized = 0;

  for (const membership of memberships) {
    const role =
      typeof membership.role === "string"
        ? membership.role.trim().toUpperCase()
        : "";

    let effectivePermissions: string[] | null = null;

    if (role === "OWNER") {
      effectivePermissions = ["*"];
    } else if (isRoleTemplate(role)) {
      effectivePermissions =
        getRoleTemplatePermissions(role);
    } else if (role === "CUSTOM") {
      // CUSTOM is intentionally tenant-admin-defined.
      // Never silently grant additional access.
      continue;
    } else {
      throw new Error(
        `Invalid organization role "${membership.role}" found in organization ${normalizedOrganizationId}.`
      );
    }

    const currentPermissions =
      membership.permissions ?? [];

    const permissionsChanged =
      JSON.stringify(currentPermissions) !==
      JSON.stringify(effectivePermissions);

    const roleChanged =
      membership.role !== role;

    if (permissionsChanged || roleChanged) {
      await db.organizationMember.update({
        where: {
          id: membership.id,
        },
        data: {
          role,
          permissions: effectivePermissions,
        },
      });

      membershipsSynchronized += 1;
    }
  }

  return {
    organizationId:
      normalizedOrganizationId,
    chartOfAccounts,
    membershipsSynchronized,
  };
}

/**
 * Runs the complete tenant baseline atomically.
 *
 * Use this for new tenant provisioning and repair jobs.
 */
export async function provisionTenantBaseline(
  prisma: PrismaClient,
  organizationId: string
): Promise<TenantBaselineResult> {
  return prisma.$transaction(
    async (tx) =>
      ensureTenantBaseline(
        tx,
        organizationId
      )
  );
}
