import { Prisma, PrismaClient } from "@prisma/client";
import {
  applyTenantBaseline,
  type TenantBaselineResult,
} from "./tenantBaseline.service";
import { applyLatestFosTemplate } from "./fosConfigurationTemplate.service";

export type TenantProvisioningDb = Prisma.TransactionClient | PrismaClient;

export async function ensureTenantBaseline(
  db: TenantProvisioningDb,
  organizationId: string,
): Promise<TenantBaselineResult> {
  const baseline = await applyTenantBaseline(db, organizationId);
  await applyLatestFosTemplate(db, organizationId);
  return baseline;
}

export async function provisionTenantBaseline(
  prisma: PrismaClient,
  organizationId: string,
): Promise<TenantBaselineResult> {
  return prisma.$transaction(async tx => {
    const baseline = await applyTenantBaseline(tx, organizationId);
    await applyLatestFosTemplate(tx, organizationId);
    return baseline;
  });
}
