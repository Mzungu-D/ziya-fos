import { Prisma, type PrismaClient } from "@prisma/client";

const TEMPLATE_KEY = "FOS_DEFAULT";
const TEMPLATE_SCHEMA_VERSION = 3;

const FORBIDDEN_DEMO_DATA_MODELS = [
  "Customer",
  "Vendor",
  "Invoice",
  "InvoiceLine",
  "Expense",
  "JournalEntry",
  "JournalEntryLine",
  "Transaction",
  "BankAccount",
  "BankPayment",
  "BankPaymentBatch",
  "MpesaAccount",
  "MpesaTransaction",
  "MpesaPaymentBatch",
  "AccountsPayable",
  "AccountsReceivable",
  "Loan",
  "Asset",
  "AssetAssignment",
  "Budget",
  "Employee",
  "Department",
  "Position",
  "EmployeeEarning",
  "EmployeePayrollProfile",
  "EmployeeLoan",
  "SalaryAdvance",
  "PayrollEarning",
  "PayrollDeduction",
  "PayrollEmployerContribution",
  "PayrollPeriod",
  "PayrollRecord",
  "TaxObligation",
  "TaxFiling",
  "TaxPayment",
  "ProcurementRequest",
  "Investment",
  "PortfolioCompany",
  "Approval",
  "AuditTrail",
  "FraudAlert",
  "SupportTicket",
  "Document",
  "Subscription",
  "OrganizationInvitation",
  "OtpVerification",
  "Session",
  "User",
] as const;

type AccountTemplate = {
  code: string;
  name: string;
  type: string;
  description: string | null;
  parentCode: string | null;
};

type RolePermissionTemplate = {
  role: string;
  permissions: string[];
};

export type TenantTemplateSnapshot = {
  schemaVersion: number;
  templateKey: typeof TEMPLATE_KEY;
  sourceOrganizationId: string;
  sourceOrganizationName: string;
  configuration: {
    accounting: {
      accounts: AccountTemplate[];
    };
    accessControl: {
      rolePermissions: RolePermissionTemplate[];
    };
  };
};

type Db = PrismaClient | Prisma.TransactionClient;

type OrganizationTemplateState = {
  id: string;
  name: string;
  status?: string;
  templateKey?: string | null;
  templateVersion: number;
};

type ApplyResult =
  | { skipped: true; reason: "template-source" | "suspended" | "up-to-date" }
  | {
      skipped: false;
      templateVersion: number;
      createdAccounts: number;
      updatedAccounts: number;
      preservedCustomizedAccounts: number;
      updatedMembers: number;
      preservedCustomizedMembers: number;
    };

function stablePermissions(value: string[] | null | undefined): string[] {
  return [...new Set(value ?? [])].sort((a, b) => a.localeCompare(b));
}

function sameStringArray(
  a: string[] | null | undefined,
  b: string[] | null | undefined,
): boolean {
  const left = stablePermissions(a);
  const right = stablePermissions(b);

  if (left.length !== right.length) return false;

  return left.every((value, index) => value === right[index]);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function assertSafeIdentifier(value: unknown, field: string): asserts value is string {
  if (!isNonEmptyString(value)) {
    throw new Error(`Invalid FOS template ${field}`);
  }
}

function assertConfigurationOnly(snapshot: unknown): asserts snapshot is TenantTemplateSnapshot {
  if (!snapshot || typeof snapshot !== "object") {
    throw new Error("Invalid FOS template snapshot");
  }

  const candidate = snapshot as Record<string, unknown>;

  if (candidate.schemaVersion !== TEMPLATE_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported FOS template schema version: ${String(candidate.schemaVersion)}`,
    );
  }

  if (candidate.templateKey !== TEMPLATE_KEY) {
    throw new Error("Invalid FOS template key");
  }

  assertSafeIdentifier(candidate.sourceOrganizationId, "source organization");
  assertSafeIdentifier(candidate.sourceOrganizationName, "source organization name");

  if (!candidate.configuration || typeof candidate.configuration !== "object") {
    throw new Error("FOS template configuration section is missing");
  }

  const configuration = candidate.configuration as Record<string, unknown>;

  if (!configuration.accounting || typeof configuration.accounting !== "object") {
    throw new Error("FOS template accounting configuration is missing");
  }

  if (!configuration.accessControl || typeof configuration.accessControl !== "object") {
    throw new Error("FOS template access-control configuration is missing");
  }

  const accounting = configuration.accounting as Record<string, unknown>;
  const accessControl = configuration.accessControl as Record<string, unknown>;

  if (!Array.isArray(accounting.accounts)) {
    throw new Error("FOS template accounts configuration is invalid");
  }

  if (!Array.isArray(accessControl.rolePermissions)) {
    throw new Error("FOS template role permissions configuration is invalid");
  }

  const accountCodes = new Set<string>();

  for (const rawAccount of accounting.accounts) {
    if (!rawAccount || typeof rawAccount !== "object") {
      throw new Error("Invalid account entry in FOS template");
    }

    const account = rawAccount as Record<string, unknown>;

    assertSafeIdentifier(account.code, "account code");
    assertSafeIdentifier(account.name, "account name");
    assertSafeIdentifier(account.type, "account type");

    if (
      account.description !== null &&
      account.description !== undefined &&
      typeof account.description !== "string"
    ) {
      throw new Error(`Invalid description for account ${account.code}`);
    }

    if (
      account.parentCode !== null &&
      account.parentCode !== undefined &&
      !isNonEmptyString(account.parentCode)
    ) {
      throw new Error(`Invalid parentCode for account ${account.code}`);
    }

    if (accountCodes.has(account.code)) {
      throw new Error(`Duplicate account code in FOS template: ${account.code}`);
    }

    accountCodes.add(account.code);
  }

  for (const rawAccount of accounting.accounts as unknown[]) {
    const account = rawAccount as AccountTemplate;

    if (account.parentCode && !accountCodes.has(account.parentCode)) {
      throw new Error(
        `Template account ${account.code} references missing parent ${account.parentCode}`,
      );
    }

    if (account.parentCode === account.code) {
      throw new Error(`Template account ${account.code} cannot be its own parent`);
    }
  }

  const roles = new Set<string>();

  for (const rawRole of accessControl.rolePermissions) {
    if (!rawRole || typeof rawRole !== "object") {
      throw new Error("Invalid role permission entry in FOS template");
    }

    const role = rawRole as Record<string, unknown>;

    assertSafeIdentifier(role.role, "role");

    if (!Array.isArray(role.permissions)) {
      throw new Error(`Invalid permissions for role ${role.role}`);
    }

    for (const permission of role.permissions) {
      if (!isNonEmptyString(permission)) {
        throw new Error(`Invalid permission in role ${role.role}`);
      }
    }

    if (roles.has(role.role)) {
      throw new Error(`Duplicate role in FOS template: ${role.role}`);
    }

    roles.add(role.role);
  }

  
  for (const forbiddenModel of FORBIDDEN_DEMO_DATA_MODELS) {
    if (Object.prototype.hasOwnProperty.call(candidate, forbiddenModel)) {
      throw new Error(
        `Forbidden Demo data detected in FOS template: ${forbiddenModel}`,
      );
    }
  }
}

function parseSnapshot(value: Prisma.JsonValue): TenantTemplateSnapshot {
  assertConfigurationOnly(value);
  return value;
}

function accountConfiguration(
  snapshot: TenantTemplateSnapshot,
): AccountTemplate[] {
  return snapshot.configuration.accounting.accounts;
}

function rolePermissionConfiguration(
  snapshot: TenantTemplateSnapshot,
): RolePermissionTemplate[] {
  return snapshot.configuration.accessControl.rolePermissions;
}

async function getTemplateSource(db: Db): Promise<OrganizationTemplateState> {
  const source = await db.organization.findUnique({
    where: { templateKey: TEMPLATE_KEY },
    select: {
      id: true,
      name: true,
      status: true,
      templateKey: true,
      templateVersion: true,
    },
  });

  if (!source) {
    throw new Error("FOS template source is not configured");
  }

  if (source.templateKey !== TEMPLATE_KEY) {
    throw new Error("Invalid FOS template source");
  }

  if (source.status === "SUSPENDED") {
    throw new Error("FOS template source organization is suspended");
  }

  return source;
}

async function getLatestTemplate(
  db: Db,
): Promise<{
  source: OrganizationTemplateState;
  template: {
    id: string;
    templateKey: string;
    version: number;
    schemaVersion: number;
    snapshot: Prisma.JsonValue;
    publishedByUserId: string | null;
    publishedAt: Date;
  };
  snapshot: TenantTemplateSnapshot;
}> {
  const source = await getTemplateSource(db);

  const template = await db.tenantTemplate.findFirst({
    where: {
      templateKey: TEMPLATE_KEY,
      sourceOrganizationId: source.id,
    },
    orderBy: [{ version: "desc" }, { publishedAt: "desc" }],
    select: {
      id: true,
      templateKey: true,
      version: true,
      schemaVersion: true,
      snapshot: true,
      publishedByUserId: true,
      publishedAt: true,
    },
  });

  if (!template) {
    throw new Error("FOS template has not been published");
  }

  if (template.schemaVersion !== TEMPLATE_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported persisted FOS template schema version: ${template.schemaVersion}`,
    );
  }

  const snapshot = parseSnapshot(template.snapshot);

  if (snapshot.templateKey !== TEMPLATE_KEY) {
    throw new Error("Persisted FOS template key mismatch");
  }

  if (snapshot.sourceOrganizationId !== source.id) {
    throw new Error("Persisted FOS template source mismatch");
  }

  if (template.version <= 0) {
    throw new Error("Invalid FOS template version");
  }

  return { source, template, snapshot };
}

export async function setTemplateSource(
  db: Db,
  organizationId: string,
): Promise<OrganizationTemplateState> {
  assertSafeIdentifier(organizationId, "organization ID");

  const organization = await db.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      status: true,
      templateKey: true,
      templateVersion: true,
    },
  });

  if (!organization) {
    throw new Error("Template source organization not found");
  }

  if (organization.status === "SUSPENDED") {
    throw new Error("A suspended organization cannot be the FOS template source");
  }

  
  await db.organization.updateMany({
    where: {
      templateKey: TEMPLATE_KEY,
      NOT: { id: organizationId },
    },
    data: { templateKey: null },
  });

  return db.organization.update({
    where: { id: organizationId },
    data: { templateKey: TEMPLATE_KEY },
    select: {
      id: true,
      name: true,
      status: true,
      templateKey: true,
      templateVersion: true,
    },
  });
}

async function buildTemplateSnapshot(
  db: Db,
  sourceOrganizationId: string,
): Promise<TenantTemplateSnapshot> {
  const source = await db.organization.findUnique({
    where: { id: sourceOrganizationId },
    select: { id: true, name: true, templateKey: true },
  });

  if (!source) {
    throw new Error("Template source organization not found");
  }

  if (source.templateKey !== TEMPLATE_KEY) {
    throw new Error("Organization is not the FOS template source");
  }

  const accounts = await db.account.findMany({
    where: { organizationId: sourceOrganizationId },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      description: true,
      parentId: true,
    },
    orderBy: [{ code: "asc" }, { id: "asc" }],
  });

  const accountIds = new Set(accounts.map((account) => account.id));

  for (const account of accounts) {
    if (account.parentId && !accountIds.has(account.parentId)) {
      throw new Error(
        `Template source account ${account.code} has a parent outside the source organization`,
      );
    }
  }

  const parentIds = [
    ...new Set(
      accounts
        .map((account) => account.parentId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const parents =
    parentIds.length > 0
      ? await db.account.findMany({
          where: {
            organizationId: sourceOrganizationId,
            id: { in: parentIds },
          },
          select: { id: true, code: true },
        })
      : [];

  const parentCodeById = new Map(
    parents.map((parent) => [parent.id, parent.code]),
  );

  const memberships = await db.organizationMember.findMany({
    where: {
      organizationId: sourceOrganizationId,
      isActive: true,
      NOT: { role: "CUSTOM" },
    },
    select: {
      role: true,
      permissions: true,
    },
    orderBy: [{ role: "asc" }, { id: "asc" }],
  });

  const roleMap = new Map<string, string[]>();

  for (const membership of memberships) {
    const permissions = stablePermissions(membership.permissions);

    
    const existing = roleMap.get(membership.role);

    if (!existing) {
      roleMap.set(membership.role, permissions);
      continue;
    }

    if (!sameStringArray(existing, permissions)) {
      throw new Error(
        `Inconsistent permissions for standard role ${membership.role} in template source`,
      );
    }
  }

  const snapshot: TenantTemplateSnapshot = {
    schemaVersion: TEMPLATE_SCHEMA_VERSION,
    templateKey: TEMPLATE_KEY,
    sourceOrganizationId: source.id,
    sourceOrganizationName: source.name,
    configuration: {
      accounting: {
        accounts: accounts.map((account) => ({
          code: account.code,
          name: account.name,
          type: account.type,
          description: account.description,
          parentCode: account.parentId
            ? (parentCodeById.get(account.parentId) ?? null)
            : null,
        })),
      },
      accessControl: {
        rolePermissions: [...roleMap.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([role, permissions]) => ({
            role,
            permissions: stablePermissions(permissions),
          })),
      },
    },
  };

  assertConfigurationOnly(snapshot);

  return snapshot;
}

export async function publishTemplate(
  db: Db,
  sourceOrganizationId: string,
  publishedByUserId?: string,
): Promise<TenantTemplateSnapshot> {
  assertSafeIdentifier(sourceOrganizationId, "source organization ID");

  if (publishedByUserId !== undefined) {
    assertSafeIdentifier(publishedByUserId, "publisher user ID");
  }

  const source = await db.organization.findUnique({
    where: { id: sourceOrganizationId },
    select: {
      id: true,
      name: true,
      status: true,
      templateKey: true,
    },
  });

  if (!source) {
    throw new Error("Template source organization not found");
  }

  if (source.status === "SUSPENDED") {
    throw new Error("A suspended organization cannot publish the FOS template");
  }

  if (source.templateKey !== TEMPLATE_KEY) {
    throw new Error("Organization is not the FOS template source");
  }

  const snapshot = await buildTemplateSnapshot(db, sourceOrganizationId);

  
  
  const lockedSource = await db.$queryRaw<Array<{ templateVersion: number }>>(
    Prisma.sql`
      SELECT "templateVersion"
      FROM "Organization"
      WHERE "id" = ${sourceOrganizationId}
      FOR UPDATE
    `,
  );

  if (lockedSource.length !== 1) {
    throw new Error("Unable to lock FOS template source for publication");
  }

  const latest = await db.tenantTemplate.findFirst({
    where: { templateKey: TEMPLATE_KEY },
    orderBy: [{ version: "desc" }, { publishedAt: "desc" }],
    select: { version: true },
  });

  const version = Math.max(
    latest?.version ?? 0,
    lockedSource[0].templateVersion ?? 0,
  ) + 1;

  await db.tenantTemplate.create({
    data: {
      templateKey: TEMPLATE_KEY,
      sourceOrganizationId,
      version,
      schemaVersion: TEMPLATE_SCHEMA_VERSION,
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

export async function bootstrapDemoAsTemplate(
  prisma: PrismaClient,
  demoOrganizationId: string,
  userId?: string,
): Promise<TenantTemplateSnapshot> {
  assertSafeIdentifier(demoOrganizationId, "Demo organization ID");

  return prisma.$transaction(async (tx) => {
    const existingSource = await tx.organization.findUnique({
      where: { templateKey: TEMPLATE_KEY },
      select: { id: true },
    });

    if (existingSource && existingSource.id !== demoOrganizationId) {
      throw new Error(
        "FOS template source is already configured. Use publishTemplate instead of bootstrap.",
      );
    }

    await setTemplateSource(tx, demoOrganizationId);

    const existingVersions = await tx.tenantTemplate.count({
      where: {
        templateKey: TEMPLATE_KEY,
        sourceOrganizationId: demoOrganizationId,
      },
    });

    if (existingVersions > 0) {
      throw new Error(
        "FOS template has already been bootstrapped for this source organization",
      );
    }

    return publishTemplate(tx, demoOrganizationId, userId);
  });
}

function currentParentCode(
  account: {
    parentId: string | null;
  },
  accountsById: Map<string, { code: string }>,
): string | null {
  if (!account.parentId) return null;
  return accountsById.get(account.parentId)?.code ?? null;
}

export async function applyLatestTenantTemplate(
  db: Db,
  organizationId: string,
): Promise<ApplyResult> {
  assertSafeIdentifier(organizationId, "organization ID");

  const { source, template, snapshot } = await getLatestTemplate(db);

  if (organizationId === source.id) {
    return { skipped: true, reason: "template-source" };
  }

  const target = await db.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      status: true,
      templateVersion: true,
    },
  });

  if (!target) {
    throw new Error("Target organization not found");
  }

  if (target.status === "SUSPENDED") {
    return { skipped: true, reason: "suspended" };
  }

  if ((target.templateVersion ?? 0) >= template.version) {
    return { skipped: true, reason: "up-to-date" };
  }

  const previousApplication = await db.tenantTemplateApplication.findUnique({
    where: { organizationId },
    select: {
      templateVersion: true,
      snapshot: true,
    },
  });

  const previous = previousApplication
    ? parseSnapshot(previousApplication.snapshot)
    : null;

  const previousAccounts = new Map(
    (previous ? accountConfiguration(previous) : []).map((account) => [
      account.code,
      account,
    ]),
  );

  const previousRoles = new Map(
    (previous ? rolePermissionConfiguration(previous) : []).map((role) => [
      role.role,
      stablePermissions(role.permissions),
    ]),
  );

  const existingAccounts = await db.account.findMany({
    where: { organizationId },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      description: true,
      parentId: true,
    },
  });

  const accountsByCode = new Map(existingAccounts.map((account) => [account.code, account]));
  const accountsById = new Map(
    existingAccounts.map((account) => [account.id, { code: account.code }]),
  );
  const createdAccountIds = new Set<string>();

  let createdAccounts = 0;
  let updatedAccounts = 0;
  let preservedCustomizedAccounts = 0;

  const incomingAccounts = accountConfiguration(snapshot);

  
  for (const incoming of incomingAccounts) {
    if (accountsByCode.has(incoming.code)) continue;

    const created = await db.account.create({
      data: {
        organizationId,
        code: incoming.code,
        name: incoming.name,
        type: incoming.type,
        description: incoming.description,
        parentId: null,
      },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        description: true,
        parentId: true,
      },
    });

    accountsByCode.set(created.code, created);
    accountsById.set(created.id, { code: created.code });
    createdAccountIds.add(created.id);
    createdAccounts += 1;
  }

  
  for (const incoming of incomingAccounts) {
    const existing = accountsByCode.get(incoming.code);

    if (!existing) {
      throw new Error(
        `Failed to resolve target account ${incoming.code} during template application`,
      );
    }

    const previous = previousAccounts.get(incoming.code);

    
    if (!previous) {
      
      if (createdAccountIds.has(existing.id)) {
        if (incoming.parentCode) {
          const parent = accountsByCode.get(incoming.parentCode);

          if (!parent) {
            throw new Error(
              `Cannot resolve parent ${incoming.parentCode} for account ${incoming.code}`,
            );
          }

          if (parent.id === existing.id) {
            throw new Error(`Account ${incoming.code} cannot be its own parent`);
          }

          const updated = await db.account.update({
            where: { id: existing.id },
            data: { parent: { connect: { id: parent.id } } },
            select: {
              id: true,
              code: true,
              name: true,
              type: true,
              description: true,
              parentId: true,
            },
          });

          accountsByCode.set(updated.code, updated);
          accountsById.set(updated.id, { code: updated.code });
          updatedAccounts += 1;
        }
      } else {
        const isExistingBeforeTemplate =
          existing.name !== incoming.name ||
          existing.type !== incoming.type ||
          existing.description !== incoming.description ||
          currentParentCode(existing, accountsById) !== incoming.parentCode;

        if (isExistingBeforeTemplate) {
          preservedCustomizedAccounts += 1;
        }
      }

      continue;
    }

    const data: Prisma.AccountUpdateInput = {};

    if (existing.name === previous.name && existing.name !== incoming.name) {
      data.name = incoming.name;
    }

    if (existing.type === previous.type && existing.type !== incoming.type) {
      data.type = incoming.type;
    }

    if (
      existing.description === previous.description &&
      existing.description !== incoming.description
    ) {
      data.description = incoming.description;
    }

    const targetParentCode = currentParentCode(existing, accountsById);

    if (
      targetParentCode === previous.parentCode &&
      targetParentCode !== incoming.parentCode
    ) {
      const parent = incoming.parentCode
        ? accountsByCode.get(incoming.parentCode)
        : undefined;

      if (incoming.parentCode && !parent) {
        throw new Error(
          `Cannot apply parent ${incoming.parentCode} for account ${incoming.code}`,
        );
      }

      data.parent = incoming.parentCode
        ? { connect: { id: parent!.id } }
        : { disconnect: true };
    }

    if (Object.keys(data).length === 0) {
      const customized =
        existing.name !== incoming.name ||
        existing.type !== incoming.type ||
        existing.description !== incoming.description ||
        targetParentCode !== incoming.parentCode;

      if (customized) {
        preservedCustomizedAccounts += 1;
      }

      continue;
    }

    const updated = await db.account.update({
      where: { id: existing.id },
      data,
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        description: true,
        parentId: true,
      },
    });

    accountsByCode.set(updated.code, updated);
    accountsById.set(updated.id, { code: updated.code });
    updatedAccounts += 1;
  }

  const incomingRoles = new Map(
    rolePermissionConfiguration(snapshot).map((role) => [
      role.role,
      stablePermissions(role.permissions),
    ]),
  );

  const currentMembers = await db.organizationMember.findMany({
    where: {
      organizationId,
      isActive: true,
      NOT: { role: "CUSTOM" },
    },
    select: {
      id: true,
      role: true,
      permissions: true,
    },
  });

  let updatedMembers = 0;
  let preservedCustomizedMembers = 0;

  for (const member of currentMembers) {
    const incoming = incomingRoles.get(member.role);

    if (!incoming) continue;

    const previousPermissions = previousRoles.get(member.role);

    
    if (!previousPermissions) {
      if (!sameStringArray(member.permissions, incoming)) {
        await db.organizationMember.update({
          where: { id: member.id },
          data: { permissions: incoming },
        });
        updatedMembers += 1;
      }
      continue;
    }

    if (sameStringArray(member.permissions, previousPermissions)) {
      if (!sameStringArray(member.permissions, incoming)) {
        await db.organizationMember.update({
          where: { id: member.id },
          data: { permissions: incoming },
        });
        updatedMembers += 1;
      }
    } else if (!sameStringArray(member.permissions, incoming)) {
      preservedCustomizedMembers += 1;
    }
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
    createdAccounts,
    updatedAccounts,
    preservedCustomizedAccounts,
    updatedMembers,
    preservedCustomizedMembers,
  };
}

export async function applyLatestTenantTemplateTransaction(
  prisma: PrismaClient,
  organizationId: string,
): Promise<ApplyResult> {
  return prisma.$transaction((tx) =>
    applyLatestTenantTemplate(tx, organizationId),
  );
}

export async function reconcileAllTenantsFromLatestTemplate(
  prisma: PrismaClient,
): Promise<{
  templateVersion: number;
  sourceOrganizationId: string;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  results: Array<Record<string, unknown>>;
}> {
  const { source, template } = await getLatestTemplate(prisma);

  const tenants = await prisma.organization.findMany({
    where: {
      id: { not: source.id },
      status: { not: "SUSPENDED" },
      templateVersion: { lt: template.version },
    },
    select: {
      id: true,
      name: true,
      status: true,
      templateVersion: true,
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });

  const results: Array<Record<string, unknown>> = [];
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (const tenant of tenants) {
    try {
      const result = await applyLatestTenantTemplateTransaction(
        prisma,
        tenant.id,
      );

      if (result.skipped) {
        skipped += 1;
      } else {
        succeeded += 1;
      }

      results.push({
        organizationId: tenant.id,
        name: tenant.name,
        ...result,
      });
    } catch (error) {
      failed += 1;

      results.push({
        organizationId: tenant.id,
        name: tenant.name,
        failed: true,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    templateVersion: template.version,
    sourceOrganizationId: source.id,
    processed: tenants.length,
    succeeded,
    failed,
    skipped,
    results,
  };
}

export async function getTemplateStatus(prisma: PrismaClient) {
  const { source, template } = await getLatestTemplate(prisma);

  const tenants = await prisma.organization.findMany({
    where: { id: { not: source.id } },
    select: {
      id: true,
      name: true,
      status: true,
      templateVersion: true,
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });

  return {
    templateKey: TEMPLATE_KEY,
    schemaVersion: TEMPLATE_SCHEMA_VERSION,
    source: {
      id: source.id,
      name: source.name,
      status: source.status,
      templateVersion: source.templateVersion,
    },
    latestVersion: template.version,
    publishedAt: template.publishedAt,
    tenants: tenants.map((tenant) => ({
      ...tenant,
      current: tenant.templateVersion >= template.version,
      pending: tenant.templateVersion < template.version,
    })),
  };
}

export async function publishFosConfiguration(
  prisma: PrismaClient,
  sourceOrganizationId: string,
  publishedByUserId?: string,
): Promise<{
  version: number;
  snapshot: TenantTemplateSnapshot;
}> {
  assertSafeIdentifier(sourceOrganizationId, "source organization ID");

  return prisma.$transaction(async (tx) => {
    const source = await tx.organization.findUnique({
      where: { id: sourceOrganizationId },
      select: { id: true, templateKey: true },
    });

    if (!source) {
      throw new Error("Template source organization not found");
    }

    if (source.templateKey !== TEMPLATE_KEY) {
      throw new Error("Organization is not the FOS template source");
    }

    const snapshot = await publishTemplate(
      tx,
      sourceOrganizationId,
      publishedByUserId,
    );

    const published = await tx.tenantTemplate.findFirstOrThrow({
      where: {
        templateKey: TEMPLATE_KEY,
        sourceOrganizationId,
      },
      orderBy: [{ version: "desc" }, { publishedAt: "desc" }],
      select: { version: true },
    });

    return {
      version: published.version,
      snapshot,
    };
  });
}

export { TEMPLATE_KEY, TEMPLATE_SCHEMA_VERSION, FORBIDDEN_DEMO_DATA_MODELS };

