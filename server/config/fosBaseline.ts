/**
 * Ziya FOS
 * Global application baseline configuration.
 *
 * IMPORTANT:
 * - This configuration is GLOBAL.
 * - It must never contain tenant-specific IDs, names, or data.
 * - It is independent of Demo Company.
 * - Tenant-specific business data must remain inside the tenant.
 *
 * Baseline versions:
 *   0 = tenant has not been reconciled with the baseline system
 *   1 = previous baseline
 *   2 = current baseline, including the expanded standard Chart of Accounts
 *
 * When a future global baseline change is introduced:
 *   1. Increase FOS_BASELINE_VERSION.
 *   2. Update the baseline reconciliation logic if necessary.
 *   3. Run a dry-run across tenants.
 *   4. Reconcile tenants deliberately.
 *
 * IMPORTANT:
 * FOS_BASELINE_VERSION is the single source of truth for the
 * currently deployed global baseline version.
 */

export const FOS_BASELINE_VERSION = 2 as const;

/**
 * Global FOS baseline metadata.
 *
 * This object intentionally contains configuration metadata only.
 * It must never contain tenant-specific records or identifiers.
 */
export const FOS_BASELINE = {
  version: FOS_BASELINE_VERSION,
} as const;