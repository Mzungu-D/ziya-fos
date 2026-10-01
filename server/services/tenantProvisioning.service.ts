import { Prisma, PrismaClient } from "@prisma/client";

import {
  applyTenantBaseline,
  type TenantBaselineResult,
} from "./tenantBaseline.service";

/**
 * Backwards-compatible tenant provisioning facade.
 *
 * Existing controllers already import tenant provisioning.
 *
 * There must be ONE actual implementation of the
 * global FOS tenant baseline.
 *
 * The implementation lives in:
 *
 *   tenantBaseline.service.ts
 *
 * This file exists only to preserve the existing
 * provisioning API.
 */
export type TenantProvisioningDb =
  | Prisma.TransactionClient
  | PrismaClient;

/**
 * Apply the global FOS baseline to a tenant.
 *
 * This intentionally delegates to the canonical baseline
 * implementation so new tenants and existing tenants
 * cannot receive different configurations.
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
 *
 * The transaction guarantees that a tenant is either:
 *
 * - fully provisioned
 *
 * or:
 *
 * - unchanged if provisioning fails.
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