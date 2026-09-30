import { Prisma, PrismaClient } from "@prisma/client";

import {
  applyTenantBaseline,
} from "./tenantBaseline.service";

/**
 * Backwards-compatible tenant provisioning facade.
 *
 * Existing controllers already import tenant provisioning.
 * Keeping this facade means we do not have to modify every
 * controller at once and, more importantly, there is now only
 * ONE actual baseline implementation.
 *
 * The implementation lives in:
 *
 *   tenantBaseline.service.ts
 *
 * This file exists only to preserve the existing provisioning API.
 */

export type TenantProvisioningDb =
  | Prisma.TransactionClient
  | PrismaClient;

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
 * Apply the global FOS baseline to a tenant.
 *
 * This function intentionally preserves the existing
 * ensureTenantBaseline name so existing callers continue
 * working without breaking imports.
 */
export async function ensureTenantBaseline(
  db: TenantProvisioningDb,
  organizationId: string
): Promise<TenantBaselineResult> {
  return applyTenantBaseline(
    db,
    organizationId
  );
}

/**
 * Provision a tenant baseline inside an atomic transaction.
 *
 * Existing callers can continue using this function.
 */
export async function provisionTenantBaseline(
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