import { Prisma, PrismaClient } from "@prisma/client";

import { FOS_BASELINE_VERSION } from "../config/fosBaseline";
import {
  DEFAULT_CHART_OF_ACCOUNTS,
  ensureStandardChartOfAccounts,
} from "./chartOfAccounts.service";
import {
  getRoleTemplatePermissions,
  isRoleTemplate,
} from "../config/roleTemplates";

/**
 * Database client accepted by the baseline service.
 *
 * Prisma.TransactionClient is required because tenant provisioning
 * already executes inside Prisma transactions.
 */
export type TenantBaselineDb =
  | Prisma.TransactionClient
  | PrismaClient;

/**
 * Result returned after applying the baseline to a tenant.
 */
export interface TenantBaselineResult {
  organizationId: string;

  previousBaselineVersion: number;

  baselineVersion: number;

  chartOfAccounts: {
    createdCount: number;
    totalStandardAccounts: number;
  };

  membershipsSynchronized: number;

  skippedCustomMemberships: number;
}

/**
 * Result returned by a baseline dry-run.
 *
 * A dry-run NEVER modifies the database.
 */
export interface TenantBaselineDryRunResult {
  organizationId: string;

  currentBaselineVersion: number;

  targetBaselineVersion: number;

  requiresUpdate: boolean;

  chartOfAccounts: {
    totalStandardAccounts: number;
    existingStandardAccounts: number;
    missingStandardAccounts: number;
  };

  memberships: {
    total: number;
    standardRolesNeedingSync: number;
    customRolesSkipped: number;
  };
}

/**
 * Normalize and validate an organization identifier.
 */
function normalizeOrganizationId(
  organizationId: string
): string {
  const normalized =
    typeof organizationId === "string"
      ? organizationId.trim()
      : "";

  if (!normalized) {
    throw new Error(
      "Organization context is required for tenant baseline operations."
    );
  }

  return normalized;
}

/**
 * Validate the application baseline version.
 */
function validateBaselineVersion(): void {
  if (
    !Number.isInteger(FOS_BASELINE_VERSION) ||
    FOS_BASELINE_VERSION < 1
  ) {
    throw new Error(
      `Invalid FOS baseline version: ${FOS_BASELINE_VERSION}.`
    );
  }
}

/**
 * Normalize a permissions array.
 *
 * This makes comparisons deterministic and prevents harmless
 * ordering differences from causing unnecessary database writes.
 */
function normalizePermissions(
  permissions: unknown
): string[] {
  if (!Array.isArray(permissions)) {
    return [];
  }

  return Array.from(
    new Set(
      permissions
        .filter(
          (permission): permission is string =>
            typeof permission === "string"
        )
        .map((permission) => permission.trim())
        .filter(Boolean)
    )
  ).sort();
}

/**
 * Compare permissions deterministically.
 */
function permissionsEqual(
  left: unknown,
  right: unknown
): boolean {
  return (
    JSON.stringify(normalizePermissions(left)) ===
    JSON.stringify(normalizePermissions(right))
  );
}

/**
 * Load an organization and verify that it exists.
 */
async function getOrganization(
  db: TenantBaselineDb,
  organizationId: string
) {
  const organization =
    await db.organization.findUnique({
      where: {
        id: organizationId,
      },
      select: {
        id: true,
        status: true,
        baselineVersion: true,
      },
    });

  if (!organization) {
    throw new Error(
      `Organization ${organizationId} was not found.`
    );
  }

  return organization;
}

/**
 * Validate that the tenant can move to the current baseline.
 *
 * Downgrades are never allowed.
 */
function validateBaselineTransition(
  currentVersion: number
): void {
  if (
    !Number.isInteger(currentVersion) ||
    currentVersion < 0
  ) {
    throw new Error(
      `Invalid stored baseline version: ${currentVersion}.`
    );
  }

  if (currentVersion > FOS_BASELINE_VERSION) {
    throw new Error(
      `Organization baseline version ${currentVersion} is newer than the application baseline ${FOS_BASELINE_VERSION}. Refusing to downgrade the tenant.`
    );
  }
}

/**
 * Synchronize standard-role permissions for one tenant.
 *
 * OWNER:
 *   Always receives full access ["*"].
 *
 * Standard role:
 *   Receives the current server-side role template.
 *
 * CUSTOM:
 *   Tenant-specific permissions are preserved.
 *
 * Unknown roles:
 *   Fail closed.
 */
async function synchronizeMemberships(
  db: TenantBaselineDb,
  organizationId: string
): Promise<{
  membershipsSynchronized: number;
  skippedCustomMemberships: number;
}> {
  const memberships =
    await db.organizationMember.findMany({
      where: {
        organizationId,
      },
      select: {
        id: true,
        role: true,
        permissions: true,
      },
    });

  let membershipsSynchronized = 0;

  let skippedCustomMemberships = 0;

  for (const membership of memberships) {
    const normalizedRole =
      typeof membership.role === "string"
        ? membership.role.trim().toUpperCase()
        : "";

    let effectivePermissions: string[];

    if (normalizedRole === "OWNER") {
      /**
       * OWNER is unrestricted within the tenant.
       *
       * This matches the existing authorization model.
       */
      effectivePermissions = ["*"];
    } else if (isRoleTemplate(normalizedRole)) {
      effectivePermissions =
        getRoleTemplatePermissions(
          normalizedRole
        );
    } else if (normalizedRole === "CUSTOM") {
      /**
       * CUSTOM permissions belong to the tenant.
       *
       * Never overwrite them during global
       * baseline reconciliation.
       */
      skippedCustomMemberships++;
      continue;
    } else {
      throw new Error(
        `Invalid organization role "${membership.role}" found in organization ${organizationId}.`
      );
    }

    const currentPermissions =
      normalizePermissions(
        membership.permissions
      );

    const expectedPermissions =
      normalizePermissions(
        effectivePermissions
      );

    const permissionsChanged =
      !permissionsEqual(
        currentPermissions,
        expectedPermissions
      );

    const roleChanged =
      membership.role !== normalizedRole;

    if (
      permissionsChanged ||
      roleChanged
    ) {
      await db.organizationMember.update({
        where: {
          id: membership.id,
        },
        data: {
          role: normalizedRole,
          permissions:
            expectedPermissions,
        },
      });

      membershipsSynchronized++;
    }
  }

  return {
    membershipsSynchronized,
    skippedCustomMemberships,
  };
}

/**
 * Apply the current global FOS baseline to exactly one tenant.
 *
 * This function is:
 * - tenant scoped
 * - idempotent
 * - independent of Demo Company
 * - safe for existing tenants
 * - safe for new tenants
 *
 * It does NOT:
 * - copy Demo Company data
 * - copy financial transactions
 * - copy customers
 * - copy vendors
 * - copy employees
 * - overwrite custom tenant accounts
 * - overwrite CUSTOM permissions
 * - cross organization boundaries
 *
 * IMPORTANT:
 * Call this using a Prisma transaction when performing
 * a production reconciliation.
 */
export async function applyTenantBaseline(
  db: TenantBaselineDb,
  organizationId: string
): Promise<TenantBaselineResult> {
  validateBaselineVersion();

  const normalizedOrganizationId =
    normalizeOrganizationId(
      organizationId
    );

  const organization =
    await getOrganization(
      db,
      normalizedOrganizationId
    );

  const previousBaselineVersion =
    organization.baselineVersion;

  validateBaselineTransition(
    previousBaselineVersion
  );

  /**
   * Ensure standard Chart of Accounts entries exist.
   *
   * The existing chart service is tenant scoped and only
   * creates missing standard accounts.
   *
   * Existing tenant accounts are not overwritten.
   */
  const chartOfAccounts =
    await ensureStandardChartOfAccounts(
      db,
      normalizedOrganizationId
    );

  /**
   * Synchronize standard roles.
   *
   * CUSTOM roles remain untouched.
   */
  const membershipResult =
    await synchronizeMemberships(
      db,
      normalizedOrganizationId
    );

  /**
   * Only mark the tenant as reconciled after all
   * baseline work has succeeded.
   *
   * When called inside a transaction, failure anywhere
   * above rolls everything back.
   */
  if (
    previousBaselineVersion !==
    FOS_BASELINE_VERSION
  ) {
    await db.organization.update({
      where: {
        id: normalizedOrganizationId,
      },
      data: {
        baselineVersion:
          FOS_BASELINE_VERSION,
      },
    });
  }

  return {
    organizationId:
      normalizedOrganizationId,

    previousBaselineVersion,

    baselineVersion:
      FOS_BASELINE_VERSION,

    chartOfAccounts,

    membershipsSynchronized:
      membershipResult.membershipsSynchronized,

    skippedCustomMemberships:
      membershipResult.skippedCustomMemberships,
  };
}

/**
 * Atomically apply the current baseline to one tenant.
 *
 * This is the preferred function for:
 * - tenant reconciliation
 * - administrative repair
 * - migration jobs
 * - deliberate baseline updates
 */
export async function applyTenantBaselineTransaction(
  prisma: PrismaClient,
  organizationId: string
): Promise<TenantBaselineResult> {
  return prisma.$transaction(
    async (tx) => {
      return applyTenantBaseline(
        tx,
        organizationId
      );
    }
  );
}

/**
 * Perform a READ-ONLY baseline assessment.
 *
 * This function never:
 * - creates records
 * - updates records
 * - deletes records
 * - changes permissions
 * - changes the baseline version
 */
export async function dryRunTenantBaseline(
  db: TenantBaselineDb,
  organizationId: string
): Promise<TenantBaselineDryRunResult> {
  validateBaselineVersion();

  const normalizedOrganizationId =
    normalizeOrganizationId(
      organizationId
    );

  const organization =
    await getOrganization(
      db,
      normalizedOrganizationId
    );

  const currentBaselineVersion =
    organization.baselineVersion;

  validateBaselineTransition(
    currentBaselineVersion
  );

  /**
   * Canonical standard account codes.
   */
  const standardAccountCodes =
    DEFAULT_CHART_OF_ACCOUNTS.map(
      (account) => account.code
    );

  /**
   * Fetch only account codes belonging to this tenant.
   */
  const existingAccounts =
    await db.account.findMany({
      where: {
        organizationId:
          normalizedOrganizationId,

        code: {
          in: standardAccountCodes,
        },
      },
      select: {
        code: true,
      },
    });

  const existingAccountCodes =
    new Set(
      existingAccounts.map(
        (account) => account.code
      )
    );

  const missingStandardAccounts =
    standardAccountCodes.filter(
      (code) =>
        !existingAccountCodes.has(code)
    ).length;

  /**
   * Load tenant memberships.
   */
  const memberships =
    await db.organizationMember.findMany({
      where: {
        organizationId:
          normalizedOrganizationId,
      },
      select: {
        role: true,
        permissions: true,
      },
    });

  let standardRolesNeedingSync = 0;

  let customRolesSkipped = 0;

  for (const membership of memberships) {
    const role =
      typeof membership.role === "string"
        ? membership.role.trim().toUpperCase()
        : "";

    if (role === "CUSTOM") {
      customRolesSkipped++;
      continue;
    }

    let expectedPermissions: string[];

    if (role === "OWNER") {
      expectedPermissions = ["*"];
    } else if (isRoleTemplate(role)) {
      expectedPermissions =
        getRoleTemplatePermissions(role);
    } else {
      throw new Error(
        `Invalid organization role "${membership.role}" found in organization ${normalizedOrganizationId}.`
      );
    }

    if (
      !permissionsEqual(
        membership.permissions,
        expectedPermissions
      )
    ) {
      standardRolesNeedingSync++;
    }
  }

  const requiresUpdate =
    currentBaselineVersion <
      FOS_BASELINE_VERSION ||
    missingStandardAccounts > 0 ||
    standardRolesNeedingSync > 0;

  return {
    organizationId:
      normalizedOrganizationId,

    currentBaselineVersion,

    targetBaselineVersion:
      FOS_BASELINE_VERSION,

    requiresUpdate,

    chartOfAccounts: {
      totalStandardAccounts:
        standardAccountCodes.length,

      existingStandardAccounts:
        existingAccountCodes.size,

      missingStandardAccounts,
    },

    memberships: {
      total: memberships.length,

      standardRolesNeedingSync,

      customRolesSkipped,
    },
  };
}