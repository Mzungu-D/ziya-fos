import prisma from "../config/prisma";
import { applyTenantBaselineTransaction } from "./tenantBaseline.service";
import { applyLatestFosTemplateTransaction } from "./fosConfigurationTemplate.service";

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

export async function reconcileAllTenants(): Promise<TenantReconciliationResult> {
  const organizations = await prisma.organization.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  const results: TenantReconciliationResult["results"] = [];

  for (const organization of organizations) {
    try {
      await applyTenantBaselineTransaction(prisma, organization.id);
      await applyLatestFosTemplateTransaction(prisma, organization.id);
      results.push({
        organizationId: organization.id,
        organizationName: organization.name,
        success: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        organizationId: organization.id,
        organizationName: organization.name,
        success: false,
        error: message,
      });
      console.error(
        `[TENANT-RECONCILIATION] FAILED for ${organization.name} (${organization.id}):`,
        error,
      );
    }
  }

  const succeeded = results.filter(result => result.success).length;
  return {
    total: results.length,
    succeeded,
    failed: results.length - succeeded,
    results,
  };
}
