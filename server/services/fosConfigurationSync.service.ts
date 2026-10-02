import type { PrismaClient } from "@prisma/client";

import {
  bootstrapDemoAsTemplate,
  publishTemplate,
  reconcileAllTenantsFromLatestTemplate,
  getTemplateStatus,
} from "./tenantTemplate.service";

/**
 * ============================================================
 * ZIYA FOS — MASTER CONFIGURATION SYNCHRONIZATION
 * ============================================================
 *
 * PURPOSE
 * -------
 * One production entry point for synchronizing FOS-wide
 * tenant configuration from the designated Demo Company.
 *
 * IMPORTANT
 * ---------
 * This service NEVER copies tenant business/financial data.
 *
 * It only operates through the approved FOS configuration
 * template engine.
 *
 * Global application-code changes already affect every tenant
 * because all tenants use the same deployed FOS application.
 *
 * This service handles tenant-stored configuration such as:
 *
 * - Chart of Accounts
 * - Account hierarchy/configuration
 * - Standard role permissions
 * - Future explicitly-approved configuration sections
 *
 * NEVER add operational data to the template extractor.
 * ============================================================
 */

export interface FosConfigurationSyncOptions {
  sourceOrganizationId: string;
  publishedByUserId?: string;
}

export interface FosConfigurationSyncResult {
  success: true;
  sourceOrganizationId: string;
  templateVersion: number;
  published: boolean;
  tenantsProcessed: number;
  tenantsUpdated: number;
  tenantsSkipped: number;
  tenantsFailed: number;
  results: Array<Record<string, unknown>>;
}

/**
 * ------------------------------------------------------------
 * PUBLISH + RECONCILE EVERYTHING
 * ------------------------------------------------------------
 *
 * This is the ONE function that should be called when Demo
 * configuration has been changed and those changes need to
 * propagate through FOS.
 *
 * Example:
 *
 * await publishAndReconcileFosConfiguration(prisma, {
 *   sourceOrganizationId: DEMO_ORGANIZATION_ID,
 *   publishedByUserId: req.user.id,
 * });
 */
export async function publishAndReconcileFosConfiguration(
  prisma: PrismaClient,
  options: FosConfigurationSyncOptions,
): Promise<FosConfigurationSyncResult> {
  const sourceOrganizationId =
    options.sourceOrganizationId?.trim();

  if (!sourceOrganizationId) {
    throw new Error(
      "A source organization ID is required.",
    );
  }

  const publishedByUserId =
    options.publishedByUserId?.trim() || undefined;

  /*
   * ----------------------------------------------------------
   * 1. VERIFY / LOCK THE TEMPLATE SOURCE
   * ----------------------------------------------------------
   *
   * bootstrapDemoAsTemplate() is intentionally NOT called here.
   *
   * Bootstrap is a one-time initialization operation.
   *
   * Once Demo is established as the FOS template source,
   * subsequent changes must use publishTemplate().
   */
  const statusBefore =
    await getTemplateStatus(prisma);

  if (
    statusBefore.source.id !==
    sourceOrganizationId
  ) {
    throw new Error(
      "The supplied organization is not the configured FOS template source.",
    );
  }

  /*
   * ----------------------------------------------------------
   * 2. PUBLISH THE CURRENT DEMO CONFIGURATION
   * ----------------------------------------------------------
   *
   * publishTemplate() reads only approved configuration from
   * the template extractor.
   *
   * It does NOT copy:
   * - invoices
   * - customers
   * - vendors
   * - expenses
   * - journals
   * - transactions
   * - bank transactions
   * - M-Pesa transactions
   * - payroll records
   * - assets
   * - procurement records
   * - tax filings
   * - users
   * - sessions
   * - documents
   * - subscriptions
   */
  await prisma.$transaction(
    async (tx) => {
      await publishTemplate(
        tx,
        sourceOrganizationId,
        publishedByUserId,
      );
    },
  );

  /*
   * ----------------------------------------------------------
   * 3. RECONCILE EVERY TENANT
   * ----------------------------------------------------------
   *
   * reconcileAllTenantsFromLatestTemplate() uses the existing
   * three-way reconciliation mechanism.
   *
   * Therefore:
   *
   * Demo changed
   *      +
   * Tenant did NOT independently change the same setting
   *      =
   * Tenant receives Demo's new configuration
   *
   * Demo changed
   *      +
   * Tenant independently customized the setting
   *      =
   * Tenant customization is preserved
   */
  const reconciliation =
    await reconcileAllTenantsFromLatestTemplate(
      prisma,
    );

  const results =
    reconciliation.results ?? [];

  let tenantsUpdated = 0;
  let tenantsSkipped = 0;
  let tenantsFailed = 0;

  for (const result of results) {
    if (result.failed === true) {
      tenantsFailed += 1;
      continue;
    }

    if (result.skipped === true) {
      tenantsSkipped += 1;
      continue;
    }

    tenantsUpdated += 1;
  }

  return {
    success: true,
    sourceOrganizationId,
    templateVersion:
      reconciliation.templateVersion,
    published: true,
    tenantsProcessed: results.length,
    tenantsUpdated,
    tenantsSkipped,
    tenantsFailed,
    results,
  };
}

/**
 * ------------------------------------------------------------
 * ONE-TIME DEMO BOOTSTRAP
 * ------------------------------------------------------------
 *
 * Run this ONLY once when the FOS template source is first
 * established.
 *
 * After this succeeds, use:
 *
 * publishAndReconcileFosConfiguration()
 *
 * for all future Demo configuration releases.
 */
export async function initializeFosConfigurationTemplate(
  prisma: PrismaClient,
  demoOrganizationId: string,
  publishedByUserId?: string,
) {
  const demoId =
    demoOrganizationId?.trim();

  if (!demoId) {
    throw new Error(
      "Demo organization ID is required.",
    );
  }

  return bootstrapDemoAsTemplate(
    prisma,
    demoId,
    publishedByUserId?.trim() || undefined,
  );
}

/**
 * ------------------------------------------------------------
 * STATUS
 * ------------------------------------------------------------
 */
export async function getFosConfigurationSyncStatus(
  prisma: PrismaClient,
) {
  return getTemplateStatus(prisma);
}