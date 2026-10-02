import type { Prisma, PrismaClient } from "@prisma/client";

export const FOS_TEMPLATE_KEY = "FOS_DEFAULT";
export const FOS_TEMPLATE_SCHEMA_VERSION = 3;

/**
 * Explicit deny-list. These are tenant business/financial/security records.
 * They must NEVER be copied from Demo into another tenant.
 */
export const FORBIDDEN_DEMO_DATA_MODELS = [
  "Customer", "Vendor", "Invoice", "InvoiceLine", "Expense",
  "JournalEntry", "JournalEntryLine", "Transaction", "BankAccount",
  "BankPayment", "BankPaymentBatch", "MpesaAccount", "MpesaTransaction",
  "MpesaPaymentBatch", "AccountsPayable", "AccountsReceivable", "Loan",
  "Asset", "AssetAssignment", "Budget", "Employee", "Department", "Position",
  "EmployeeEarning", "EmployeePayrollProfile", "EmployeeLoan", "SalaryAdvance",
  "PayrollEarning", "PayrollDeduction", "PayrollEmployerContribution",
  "PayrollPeriod", "PayrollRecord", "TaxObligation", "TaxFiling", "TaxPayment",
  "ProcurementRequest", "Investment", "PortfolioCompany", "Approval", "AuditTrail",
  "FraudAlert", "SupportTicket", "Document", "Subscription", "OrganizationInvitation",
  "OtpVerification", "Session", "User",
] as const;

export type FosTemplateAccount = {
  code: string;
  name: string;
  type: string;
  description: string | null;
  parentCode: string | null;
};

export type FosTemplateRole = {
  role: string;
  permissions: string[];
};

export type FosTemplateSnapshot = {
  schemaVersion: number;
  templateKey: string;
  sourceOrganizationId: string;
  sourceOrganizationName: string;
  accounts: FosTemplateAccount[];
  rolePermissions: FosTemplateRole[];
};

type Db = PrismaClient | Prisma.TransactionClient;

type SyncResult = {
  skipped: boolean;
  reason?: string;
  templateVersion?: number;
  accountsCreated?: number;
  accountsUpdated?: number;
  permissionsUpdated?: number;
};

function stableStrings(values: string[] | null | undefined): string[] {
  return [...new Set((values ?? []).filter((v): v is string => typeof v === "string").map(v => v.trim()).filter(Boolean))].sort();
}

function sameStrings(a: string[] | null | undefined, b: string[] | null | undefined): boolean {
  return JSON.stringify(stableStrings(a)) === JSON.stringify(stableStrings(b));
}

function assertTemplate(snapshot: FosTemplateSnapshot): void {
  if (snapshot.schemaVersion !== FOS_TEMPLATE_SCHEMA_VERSION) {
    throw new Error(`Unsupported FOS template schema version: ${snapshot.schemaVersion}`);
  }
  if (snapshot.templateKey !== FOS_TEMPLATE_KEY) {
    throw new Error("Invalid FOS template key.");
  }
  if (!snapshot.sourceOrganizationId || !snapshot.sourceOrganizationName) {
    throw new Error("Invalid FOS template source.");
  }
  if (!Array.isArray(snapshot.accounts) || !Array.isArray(snapshot.rolePermissions)) {
    throw new Error("Invalid FOS template snapshot.");
  }

  const allowed = new Set(["schemaVersion", "templateKey", "sourceOrganizationId", "sourceOrganizationName", "accounts", "rolePermissions"]);
  for (const key of Object.keys(snapshot as Record<string, unknown>)) {
    if (!allowed.has(key)) throw new Error(`Unexpected FOS template field: ${key}`);
  }
}

async function getTemplateSource(db: Db) {
  return db.organization.findFirst({
    where: { templateKey: FOS_TEMPLATE_KEY },
    select: { id: true, name: true, templateKey: true, templateVersion: true },
  });
}

async function getLatestTemplate(db: Db) {
  const source = await getTemplateSource(db);
  if (!source) throw new Error("FOS template source is not configured.");

  const template = await db.tenantTemplate.findFirst({
    where: { sourceOrganizationId: source.id, templateKey: FOS_TEMPLATE_KEY },
    orderBy: { version: "desc" },
  });
  if (!template) throw new Error("FOS template has not been published.");

  const snapshot = template.snapshot as unknown as FosTemplateSnapshot;
  assertTemplate(snapshot);
  return { source, template, snapshot };
}

export async function setFosTemplateSource(db: Db, organizationId: string) {
  const source = await db.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, status: true },
  });
  if (!source) throw new Error("Template source organization not found.");
  if (source.status === "SUSPENDED") throw new Error("A suspended organization cannot be the FOS template source.");

  await db.organization.updateMany({
    where: { templateKey: FOS_TEMPLATE_KEY, NOT: { id: organizationId } },
    data: { templateKey: null },
  });

  return db.organization.update({
    where: { id: organizationId },
    data: { templateKey: FOS_TEMPLATE_KEY },
    select: { id: true, name: true, templateKey: true, templateVersion: true },
  });
}

export async function publishFosTemplate(
  db: Db,
  sourceOrganizationId: string,
  publishedByUserId?: string,
): Promise<FosTemplateSnapshot> {
  const source = await db.organization.findUnique({
    where: { id: sourceOrganizationId },
    select: { id: true, name: true, templateKey: true, templateVersion: true },
  });
  if (!source) throw new Error("Template source organization not found.");
  if (source.templateKey !== FOS_TEMPLATE_KEY) throw new Error("Organization is not the FOS template source.");

  const accounts = await db.account.findMany({
    where: { organizationId: sourceOrganizationId },
    select: { id: true, code: true, name: true, type: true, description: true, parentId: true },
    orderBy: { code: "asc" },
  });

  const parentIds = [...new Set(accounts.map(a => a.parentId).filter((id): id is string => Boolean(id)))];
  const parents = parentIds.length
    ? await db.account.findMany({
        where: { organizationId: sourceOrganizationId, id: { in: parentIds } },
        select: { id: true, code: true },
      })
    : [];
  const parentCodeById = new Map(parents.map(parent => [parent.id, parent.code]));

  const members = await db.organizationMember.findMany({
    where: { organizationId: sourceOrganizationId, isActive: true, NOT: { role: "CUSTOM" } },
    select: { role: true, permissions: true },
    orderBy: { role: "asc" },
  });

  const roleMap = new Map<string, string[]>();
  for (const member of members) {
    if (!roleMap.has(member.role)) roleMap.set(member.role, stableStrings(member.permissions));
  }

  const snapshot: FosTemplateSnapshot = {
    schemaVersion: FOS_TEMPLATE_SCHEMA_VERSION,
    templateKey: FOS_TEMPLATE_KEY,
    sourceOrganizationId: source.id,
    sourceOrganizationName: source.name,
    accounts: accounts.map(account => ({
      code: account.code,
      name: account.name,
      type: account.type,
      description: account.description,
      parentCode: account.parentId ? (parentCodeById.get(account.parentId) ?? null) : null,
    })),
    rolePermissions: [...roleMap.entries()].map(([role, permissions]) => ({ role, permissions })),
  };

  assertTemplate(snapshot);

  const version = (source.templateVersion ?? 0) + 1;
  await db.tenantTemplate.create({
    data: {
      templateKey: FOS_TEMPLATE_KEY,
      sourceOrganizationId,
      version,
      schemaVersion: FOS_TEMPLATE_SCHEMA_VERSION,
      snapshot: snapshot as unknown as Prisma.InputJsonValue,
      publishedByUserId: publishedByUserId ?? null,
    },
  });

  await db.organization.update({
    where: { id: sourceOrganizationId },
    data: { templateVersion: version },
  });

  return snapshot;
}

export async function bootstrapDemoAsFosTemplate(
  prisma: PrismaClient,
  demoOrganizationId: string,
  publishedByUserId?: string,
) {
  return prisma.$transaction(async tx => {
    await setFosTemplateSource(tx, demoOrganizationId);
    return publishFosTemplate(tx, demoOrganizationId, publishedByUserId);
  });
}

export async function applyLatestFosTemplate(
  db: Db,
  organizationId: string,
): Promise<SyncResult> {
  const { source, template, snapshot } = await getLatestTemplate(db);
  if (organizationId === source.id) return { skipped: true, reason: "template-source" };

  const target = await db.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, status: true, templateVersion: true },
  });
  if (!target) throw new Error(`Target organization ${organizationId} not found.`);
  if (target.status === "SUSPENDED") return { skipped: true, reason: "suspended" };
  if ((target.templateVersion ?? 0) >= template.version) return { skipped: true, reason: "up-to-date", templateVersion: template.version };

  const previousApplication = await db.tenantTemplateApplication.findUnique({ where: { organizationId } });
  const previous = previousApplication?.snapshot as unknown as FosTemplateSnapshot | null;

  const existingAccounts = await db.account.findMany({
    where: { organizationId },
    select: { id: true, code: true, name: true, type: true, description: true, parentId: true },
  });
  const byCode = new Map(existingAccounts.map(account => [account.code, account]));
  const oldByCode = new Map((previous?.accounts ?? []).map(account => [account.code, account]));

  let accountsCreated = 0;
  let accountsUpdated = 0;

  for (const incoming of snapshot.accounts) {
    const existing = byCode.get(incoming.code);

    if (!existing) {
      const parent = incoming.parentCode ? byCode.get(incoming.parentCode) : undefined;
      const created = await db.account.create({
        data: {
          organizationId,
          code: incoming.code,
          name: incoming.name,
          type: incoming.type,
          description: incoming.description,
          parentId: parent?.id ?? null,
        },
        select: { id: true, code: true, name: true, type: true, description: true, parentId: true },
      });
      byCode.set(created.code, created);
      accountsCreated += 1;
      continue;
    }

    const old = oldByCode.get(incoming.code);
    if (!old) continue; // Tenant-created/custom account: never overwrite it.

    const data: Prisma.AccountUpdateInput = {};
    if (existing.name === old.name) data.name = incoming.name;
    if (existing.type === old.type) data.type = incoming.type;
    if (existing.description === old.description) data.description = incoming.description;

    const currentParentCode = existing.parentId ? (byCode.get(existing.parentId)?.code ?? null) : null;
    if (currentParentCode === old.parentCode) {
      data.parent = incoming.parentCode
        ? { connect: { organizationId_code: { organizationId, code: incoming.parentCode } } }
        : { disconnect: true };
    }

    if (Object.keys(data).length > 0) {
      const updated = await db.account.update({
        where: { id: existing.id },
        data,
        select: { id: true, code: true, name: true, type: true, description: true, parentId: true },
      });
      byCode.set(updated.code, updated);
      accountsUpdated += 1;
    }
  }

  const oldRoles = new Map((previous?.rolePermissions ?? []).map(role => [role.role, role.permissions]));
  const incomingRoles = new Map(snapshot.rolePermissions.map(role => [role.role, role.permissions]));
  const members = await db.organizationMember.findMany({
    where: { organizationId, isActive: true, NOT: { role: "CUSTOM" } },
    select: { id: true, role: true, permissions: true },
  });

  let permissionsUpdated = 0;
  for (const member of members) {
    const incoming = incomingRoles.get(member.role);
    const old = oldRoles.get(member.role);
    if (!incoming || !old || !sameStrings(member.permissions, old)) continue;

    await db.organizationMember.update({
      where: { id: member.id },
      data: { permissions: stableStrings(incoming) },
    });
    permissionsUpdated += 1;
  }

  await db.tenantTemplateApplication.upsert({
    where: { organizationId },
    create: {
      organizationId,
      templateVersion: template.version,
      snapshot: snapshot as unknown as Prisma.InputJsonValue,
    },
    update: {
      templateVersion: template.version,
      snapshot: snapshot as unknown as Prisma.InputJsonValue,
    },
  });

  await db.organization.update({
    where: { id: organizationId },
    data: { templateVersion: template.version },
  });

  return {
    skipped: false,
    templateVersion: template.version,
    accountsCreated,
    accountsUpdated,
    permissionsUpdated,
  };
}

export async function applyLatestFosTemplateTransaction(prisma: PrismaClient, organizationId: string) {
  return prisma.$transaction(tx => applyLatestFosTemplate(tx, organizationId));
}

export async function reconcileAllTenantsFromLatestFosTemplate(prisma: PrismaClient) {
  const { source, template } = await getLatestTemplate(prisma);
  const tenants = await prisma.organization.findMany({
    where: {
      id: { not: source.id },
      status: { not: "SUSPENDED" },
      templateVersion: { lt: template.version },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const results: Array<Record<string, unknown>> = [];
  for (const tenant of tenants) {
    try {
      results.push({ organizationId: tenant.id, name: tenant.name, ...(await applyLatestFosTemplateTransaction(prisma, tenant.id)) });
    } catch (error) {
      results.push({ organizationId: tenant.id, name: tenant.name, skipped: false, failed: true, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return { templateVersion: template.version, sourceOrganizationId: source.id, results };
}

export async function getFosTemplateStatus(prisma: PrismaClient) {
  const source = await getTemplateSource(prisma);
  if (!source) return { configured: false, source: null, latestVersion: 0, tenants: [] };

  const template = await prisma.tenantTemplate.findFirst({
    where: { sourceOrganizationId: source.id, templateKey: FOS_TEMPLATE_KEY },
    orderBy: { version: "desc" },
    select: { version: true, schemaVersion: true, publishedAt: true },
  });

  const tenants = await prisma.organization.findMany({
    where: { id: { not: source.id } },
    select: { id: true, name: true, status: true, templateVersion: true },
    orderBy: { name: "asc" },
  });

  return {
    configured: true,
    source,
    latestVersion: template?.version ?? 0,
    schemaVersion: template?.schemaVersion ?? null,
    publishedAt: template?.publishedAt ?? null,
    tenants,
  };
}
