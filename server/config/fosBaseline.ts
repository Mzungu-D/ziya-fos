/**
 * Ziya FOS
 * Global Application Baseline
 *
 * PURPOSE
 * -------
 * This module identifies the currently deployed global FOS
 * baseline that tenant organizations must reconcile against.
 *
 * ARCHITECTURE
 * ------------
 * The baseline version is application configuration.
 *
 * It is NOT:
 * - a tenant identifier
 * - a tenant configuration record
 * - a Demo Company identifier
 * - financial data
 * - accounting transactions
 * - customer/vendor data
 * - a copy of any organization's database records
 *
 * GLOBAL SOURCES OF TRUTH
 * -----------------------
 * Individual baseline components remain owned by their
 * dedicated modules:
 *
 * - Chart of Accounts
 *     server/services/chartOfAccounts.service.ts
 *
 * - Standard role permissions
 *     server/config/roleTemplates.ts
 *
 * - Tenant baseline application/reconciliation
 *     server/services/tenantBaseline.service.ts
 *
 * This file only identifies the deployed baseline release.
 *
 * VERSIONING RULE
 * ---------------
 * FOS_BASELINE_VERSION must increase when a deliberate,
 * backward-compatible global FOS configuration change is
 * released and existing tenants must be reconciled to it.
 *
 * Baseline versions must NEVER be:
 * - tenant-specific
 * - based on Demo Company data
 * - downgraded
 * - reused for unrelated releases
 *
 * Tenant financial and operational data remains isolated by
 * organizationId and is never propagated by the baseline.
 */

/**
 * Current global FOS baseline release.
 *
 * v3 represents the production baseline containing the
 * canonical tenant reconciliation changes introduced for
 * the current FOS release.
 *
 * IMPORTANT:
 * Changing this number does NOT create financial data.
 * It only tells the tenant reconciliation service that
 * organizations below this version need reconciliation.
 */
export const FOS_BASELINE_VERSION = 3 as const;

/**
 * Public baseline descriptor.
 *
 * Kept as a readonly compatibility object for code that
 * needs the complete deployed baseline descriptor rather
 * than importing the version constant directly.
 *
 * The actual baseline definitions remain in their dedicated
 * canonical modules and are NOT duplicated here.
 */
export const FOS_BASELINE = Object.freeze({
  version: FOS_BASELINE_VERSION,
});