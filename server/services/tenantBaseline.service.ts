import { Prisma, PrismaClient } from "@prisma/client";

import { FOS_BASELINE_VERSION } from "../config/fosBaseline";

import {
  getRoleTemplatePermissions,
  isRoleTemplate,
} from "../config/roleTemplates";

const MAX_ORGANIZATION_ID_LENGTH = 128;

/* =========================================================
   DATABASE TYPES
========================================================= */

export type TenantBaselineDb =
  | Prisma.TransactionClient
  | PrismaClient;

/* =========================================================
   RESULT TYPES
========================================================= */

export interface TenantBaselineResult {
  organizationId: string;
  previousBaselineVersion: number;
  baselineVersion: number;

  membershipsSynchronized: number;
  skippedCustomMemberships: number;
}

export interface TenantBaselineDryRunResult {
  organizationId: string;

  currentBaselineVersion: number;
  targetBaselineVersion: number;

  requiresUpdate: boolean;

  memberships: {
    total: number;
    standardRolesNeedingSync: number;
    customRolesSkipped: number;
  };
}

/* =========================================================
   ORGANIZATION VALIDATION
========================================================= */

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

  if (normalized.length > MAX_ORGANIZATION_ID_LENGTH) {
    throw new Error("Organization context is invalid.");
  }

  return normalized;
}

/* =========================================================
   BASELINE VERSION VALIDATION
========================================================= */

function validateBaselineVersion(): number {
  if (
    !Number.isInteger(FOS_BASELINE_VERSION) ||
    FOS_BASELINE_VERSION < 1
  ) {
    throw new Error(
      "FOS_BASELINE_VERSION must be a positive integer."
    );
  }

  return FOS_BASELINE_VERSION;
}

/* =========================================================
   PERMISSION NORMALIZATION
========================================================= */

function normalizePermissions(
  permissions: string[] | null | undefined
): string[] {
  return Array.from(
    new Set(
      (permissions ?? [])
        .filter(
          (permission): permission is string =>
            typeof permission === "string"
        )
        .map((permission) => permission.trim())
        .filter(Boolean)
    )
  ).sort();
}

/* =========================================================
   PERMISSION COMPARISON
========================================================= */

function permissionsEqual(
  left: string[] | null | undefined,
  right: string[] | null | undefined
): boolean {
  const normalizedLeft = normalizePermissions(left);
  const normalizedRight = normalizePermissions(right);

  if (
    normalizedLeft.length !==
    normalizedRight.length
  ) {
    return false;
  }

  return normalizedLeft.every(
    (permission, index) =>
      permission === normalizedRight[index]
  );
}

/* =========================================================
   ORGANIZATION LOCK
========================================================= */

async function lockOrganization(
  db: TenantBaselineDb,
  organizationId: string
): Promise<void> {
  await db.$queryRaw<{ id: string }[]>`
    SELECT "id"
    FROM "Organization"
    WHERE "id" = ${organizationId}
    FOR UPDATE
  `;
}

/* =========================================================
   ORGANIZATION LOOKUP
========================================================= */

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

/* =========================================================
   MEMBERSHIP SYNCHRONIZATION
=========================================================

   Global role rules:

   OWNER
     → full tenant permissions ["*"]

   Standard role
     → current server-side role template

   CUSTOM
     → completely tenant controlled

   Unknown role
     → fail closed

   IMPORTANT:

   This function only operates on memberships belonging to
   the supplied organizationId.

   It never reads or modifies memberships belonging to
   another organization.
========================================================= */

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

    /* -------------------------------------------------------
       OWNER
    ------------------------------------------------------- */

    if (normalizedRole === "OWNER") {
      effectivePermissions = ["*"];
    }

    /* -------------------------------------------------------
       STANDARD ROLE
    ------------------------------------------------------- */

    else if (isRoleTemplate(normalizedRole)) {
      effectivePermissions =
        getRoleTemplatePermissions(
          normalizedRole
        );
    }

    /* -------------------------------------------------------
       CUSTOM ROLE
    ------------------------------------------------------- */

    else if (normalizedRole === "CUSTOM") {
      /*
       * Custom permissions belong to the tenant.
       *
       * Never overwrite them as part of a global FOS
       * baseline update.
       */
      skippedCustomMemberships++;
      continue;
    }

    /* -------------------------------------------------------
       UNKNOWN ROLE
    ------------------------------------------------------- */

    else {
      throw new Error(
        `Invalid organization role "${membership.role}" found in organization ${organizationId}.`
      );
    }

    const normalizedEffectivePermissions =
      normalizePermissions(
        effectivePermissions
      );

    const permissionsChanged =
      !permissionsEqual(
        membership.permissions,
        normalizedEffectivePermissions
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
            normalizedEffectivePermissions,
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

/* =========================================================
   APPLY TENANT BASELINE
=========================================================

   IMPORTANT ARCHITECTURAL RULE:

   This function MUST NOT create or modify tenant business
   or financial data.

   It does NOT:

   - create Chart of Accounts
   - create customers
   - create vendors
   - create invoices
   - create expenses
   - create journal entries
   - create journal lines
   - create budgets
   - create assets
   - create bank accounts
   - create transactions
   - create loans
   - create employees
   - copy Demo Company data
   - copy data from another organization
   - modify tenant financial records

   The only tenant-scoped mutation performed here is
   synchronization of globally managed role permissions.

   CUSTOM memberships remain completely tenant-controlled.

   Baseline versions cannot be downgraded.
========================================================= */

export async function applyTenantBaseline(
  db: TenantBaselineDb,
  organizationId: string
): Promise<TenantBaselineResult> {
  const normalizedOrganizationId =
    normalizeOrganizationId(
      organizationId
    );

  const targetBaselineVersion =
    validateBaselineVersion();

  /*
   * Baseline reconciliation is a tenant-scoped configuration operation.
   * Serialize concurrent applications for the same organization so two
   * requests cannot race on baselineVersion or membership permissions.
   * This lock is only valid inside a transaction; callers should use
   * applyTenantBaselineTransaction() for production writes.
   */
  await lockOrganization(
    db,
    normalizedOrganizationId
  );

  const organization =
    await getOrganization(
      db,
      normalizedOrganizationId
    );

  const previousBaselineVersion =
    organization.baselineVersion;

  /* ---------------------------------------------------------
     Never downgrade a tenant.
  --------------------------------------------------------- */

  if (
    previousBaselineVersion >
    targetBaselineVersion
  ) {
    throw new Error(
      `Organization ${normalizedOrganizationId} is already on baseline version ${previousBaselineVersion}, which is newer than the application baseline version ${targetBaselineVersion}. Refusing to downgrade the tenant baseline.`
    );
  }

  /* ---------------------------------------------------------
     IMPORTANT:

     NO Chart of Accounts initialization here.

     NO tenant financial data creation here.

     A tenant must explicitly request default accounts
     through the tenant-facing initialization endpoint.
  --------------------------------------------------------- */

  const membershipResult =
    await synchronizeMemberships(
      db,
      normalizedOrganizationId
    );

  /* ---------------------------------------------------------
     Only mark the tenant as being on the new baseline after
     all baseline operations have completed successfully.

     When called inside a Prisma transaction, any failure
     rolls everything back.
  --------------------------------------------------------- */

  if (
    previousBaselineVersion !==
    targetBaselineVersion
  ) {
    await db.organization.update({
      where: {
        id: normalizedOrganizationId,
      },

      data: {
        baselineVersion:
          targetBaselineVersion,
      },
    });
  }

  return {
    organizationId:
      normalizedOrganizationId,

    previousBaselineVersion,

    baselineVersion:
      targetBaselineVersion,

    membershipsSynchronized:
      membershipResult.membershipsSynchronized,

    skippedCustomMemberships:
      membershipResult.skippedCustomMemberships,
  };
}

/* =========================================================
   TRANSACTION WRAPPER
========================================================= */

export async function applyTenantBaselineTransaction(
  prisma: PrismaClient,
  organizationId: string
): Promise<TenantBaselineResult> {
  /*
   * Production write entry point. The transaction guarantees that role
   * synchronization and baselineVersion advancement succeed or roll back
   * together.
   */
  return prisma.$transaction(
    async (tx) =>
      applyTenantBaseline(
        tx,
        organizationId
      )
  );
}

/* =========================================================
   READ-ONLY BASELINE DRY RUN
=========================================================

   This function NEVER:

   - creates records
   - updates records
   - deletes records
   - changes permissions
   - changes account metadata
   - changes baselineVersion

   It only reports whether globally managed membership
   permissions require synchronization.

   Financial/accounting configuration is intentionally NOT
   part of baseline reconciliation.
========================================================= */

export async function dryRunTenantBaseline(
  db: TenantBaselineDb,
  organizationId: string
): Promise<TenantBaselineDryRunResult> {
  const normalizedOrganizationId =
    normalizeOrganizationId(
      organizationId
    );

  const targetBaselineVersion =
    validateBaselineVersion();

  const organization =
    await getOrganization(
      db,
      normalizedOrganizationId
    );

  /* ---------------------------------------------------------
     Prevent assessment of a tenant that is newer than the
     currently deployed application baseline.
  --------------------------------------------------------- */

  if (
    organization.baselineVersion >
    targetBaselineVersion
  ) {
    throw new Error(
      `Organization ${normalizedOrganizationId} is already on baseline version ${organization.baselineVersion}, which is newer than the application baseline version ${targetBaselineVersion}.`
    );
  }

  /* ---------------------------------------------------------
     Load tenant memberships only.
  --------------------------------------------------------- */

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

  /* ---------------------------------------------------------
     Assess membership synchronization.
  --------------------------------------------------------- */

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
    }

    else if (isRoleTemplate(role)) {
      expectedPermissions =
        getRoleTemplatePermissions(
          role
        );
    }

    else {
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

  /* ---------------------------------------------------------
     Determine whether baseline reconciliation is required.
  --------------------------------------------------------- */

  const baselineIsBehind =
    organization.baselineVersion <
    targetBaselineVersion;

  const requiresUpdate =
    baselineIsBehind ||
    standardRolesNeedingSync > 0;

  return {
    organizationId:
      normalizedOrganizationId,

    currentBaselineVersion:
      organization.baselineVersion,

    targetBaselineVersion,

    requiresUpdate,

    memberships: {
      total:
        memberships.length,

      standardRolesNeedingSync,

      customRolesSkipped,
    },
  };
}