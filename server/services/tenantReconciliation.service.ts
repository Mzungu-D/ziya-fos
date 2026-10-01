import prisma from "../config/prisma";
import {
  applyTenantBaselineTransaction,
} from "./tenantBaseline.service";

export interface TenantReconciliationResult {
  total: number;
  succeeded: number;
  failed: number;
  results: Array<{
    organizationId: string;
    organizationName: string;
    success: boolean;
    error?: string;
  }>;
}

/**
 * Reconcile the current global FOS baseline across every active tenant.
 *
 * IMPORTANT:
 * - Does NOT copy Demo Company data.
 * - Does NOT copy invoices, expenses, customers, vendors, journals,
 *   transactions or other business data.
 * - Each tenant is processed independently.
 * - Each tenant runs inside its own transaction.
 * - A failure in one tenant does not stop reconciliation of others.
 */
export async function reconcileAllTenants(): Promise<TenantReconciliationResult> {
  const organizations = await prisma.organization.findMany({
    where: {
      status: "ACTIVE",
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const results: TenantReconciliationResult["results"] = [];

  for (const organization of organizations) {
    try {
      const result =
        await applyTenantBaselineTransaction(
          prisma,
          organization.id
        );

      results.push({
        organizationId: organization.id,
        organizationName: organization.name,
        success: true,
      });

      console.log(
        `[TENANT-RECONCILIATION] ${organization.name} (${organization.id}) synchronized:`,
        {
          previousBaselineVersion:
            result.previousBaselineVersion,
          baselineVersion:
            result.baselineVersion,
          accountsCreated:
            result.chartOfAccounts.createdCount,
          membershipsSynchronized:
            result.membershipsSynchronized,
          customMembershipsSkipped:
            result.skippedCustomMemberships,
        }
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      results.push({
        organizationId: organization.id,
        organizationName: organization.name,
        success: false,
        error: message,
      });

      console.error(
        `[TENANT-RECONCILIATION] FAILED for ${organization.name} (${organization.id}):`,
        error
      );
    }
  }

  const succeeded =
    results.filter(
      (result) => result.success
    ).length;

  const failed =
    results.length - succeeded;

  return {
    total: results.length,
    succeeded,
    failed,
    results,
  };
}