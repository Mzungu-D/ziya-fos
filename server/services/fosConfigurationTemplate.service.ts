import type { Prisma, PrismaClient } from "@prisma/client";

export const FOS_TEMPLATE_KEY = "FOS_DEFAULT";

/**
 * Template schema v4
 *
 * IMPORTANT:
 * - The FOS template contains configuration only.
 * - Chart of Accounts is tenant-owned.
 * - Demo Company accounts are NEVER copied to another tenant.
 * - Financial/operational data is NEVER copied between tenants.
 * - Existing tenant accounts are NEVER created, updated, or deleted
 *   by the FOS template engine.
 */
export const FOS_TEMPLATE_SCHEMA_VERSION = 4;

/**
 * Explicit deny-list.
 *
 * These are tenant business, financial, operational, security,
 * or user records and must NEVER be copied from the template
 * source organization into another tenant.
 */
export const FORBIDDEN_DEMO_DATA_MODELS = [
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

/**
 * Role permission configuration is safe to synchronize.
 *
 * Account configuration is intentionally NOT part of the
 * FOS template snapshot.
 */
export type FosTemplateRole = {
  role: string;
  permissions: string[];
};

export type FosTemplateSnapshot = {
  schemaVersion: number;
  templateKey: string;
  sourceOrganizationId: string;
  sourceOrganizationName: string;
  rolePermissions: FosTemplateRole[];
};

type Db = PrismaClient | Prisma.TransactionClient;

type SyncResult = {
  skipped: boolean;
  reason?: string;
  templateVersion?: number;
  permissionsUpdated?: number;
};

function stableStrings(
  values: string[] | null | undefined,
): string[] {
  return [
    ...new Set(
      (values ?? [])
        .filter(
          (value): value is string =>
            typeof value === "string",
        )
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ].sort();
}

function sameStrings(
  a: string[] | null | undefined,
  b: string[] | null | undefined,
): boolean {
  return (
    JSON.stringify(stableStrings(a)) ===
    JSON.stringify(stableStrings(b))
  );
}

/**
 * Validates the structure of a persisted FOS template.
 *
 * Deliberately rejects legacy snapshots containing `accounts`.
 * This prevents an old Demo-based account snapshot from being
 * interpreted as a valid current template.
 */
function assertTemplate(
  snapshot: FosTemplateSnapshot,
): void {
  if (
    snapshot.schemaVersion !==
    FOS_TEMPLATE_SCHEMA_VERSION
  ) {
    throw new Error(
      `Unsupported FOS template schema version: ${snapshot.schemaVersion}. ` +
        `Expected ${FOS_TEMPLATE_SCHEMA_VERSION}.`,
    );
  }

  if (snapshot.templateKey !== FOS_TEMPLATE_KEY) {
    throw new Error(
      "Invalid FOS template key.",
    );
  }

  if (
    !snapshot.sourceOrganizationId ||
    !snapshot.sourceOrganizationName
  ) {
    throw new Error(
      "Invalid FOS template source.",
    );
  }

  if (
    !Array.isArray(
      snapshot.rolePermissions,
    )
  ) {
    throw new Error(
      "Invalid FOS template snapshot.",
    );
  }

  /**
   * Strict schema validation.
   *
   * `accounts` is intentionally absent.
   */
  const allowed = new Set([
    "schemaVersion",
    "templateKey",
    "sourceOrganizationId",
    "sourceOrganizationName",
    "rolePermissions",
  ]);

  for (const key of Object.keys(
    snapshot as Record<string, unknown>,
  )) {
    if (!allowed.has(key)) {
      throw new Error(
        `Unexpected FOS template field: ${key}`,
      );
    }
  }

  for (const role of snapshot.rolePermissions) {
    if (
      !role ||
      typeof role.role !== "string" ||
      !Array.isArray(role.permissions)
    ) {
      throw new Error(
        "Invalid FOS template role permission entry.",
      );
    }
  }
}

async function getTemplateSource(db: Db) {
  return db.organization.findFirst({
    where: {
      templateKey: FOS_TEMPLATE_KEY,
    },
    select: {
      id: true,
      name: true,
      templateKey: true,
      templateVersion: true,
    },
  });
}

async function getLatestTemplate(db: Db) {
  const source =
    await getTemplateSource(db);

  if (!source) {
    throw new Error(
      "FOS template source is not configured.",
    );
  }

  const template =
    await db.tenantTemplate.findFirst({
      where: {
        sourceOrganizationId: source.id,
        templateKey: FOS_TEMPLATE_KEY,
      },
      orderBy: {
        version: "desc",
      },
    });

  if (!template) {
    throw new Error(
      "FOS template has not been published.",
    );
  }

  const snapshot =
    template.snapshot as unknown as FosTemplateSnapshot;

  assertTemplate(snapshot);

  return {
    source,
    template,
    snapshot,
  };
}

/**
 * Sets the organization that is allowed to publish
 * the global FOS configuration template.
 *
 * This changes only the template-source marker.
 * It does not copy or delete tenant data.
 */
export async function setFosTemplateSource(
  db: Db,
  organizationId: string,
) {
  const source =
    await db.organization.findUnique({
      where: {
        id: organizationId,
      },
      select: {
        id: true,
        status: true,
      },
    });

  if (!source) {
    throw new Error(
      "Template source organization not found.",
    );
  }

  if (source.status === "SUSPENDED") {
    throw new Error(
      "A suspended organization cannot be the FOS template source.",
    );
  }

  await db.organization.updateMany({
    where: {
      templateKey: FOS_TEMPLATE_KEY,
      NOT: {
        id: organizationId,
      },
    },
    data: {
      templateKey: null,
    },
  });

  return db.organization.update({
    where: {
      id: organizationId,
    },
    data: {
      templateKey: FOS_TEMPLATE_KEY,
    },
    select: {
      id: true,
      name: true,
      templateKey: true,
      templateVersion: true,
    },
  });
}

/**
 * Publishes the global FOS configuration template.
 *
 * IMPORTANT:
 * This function intentionally DOES NOT read the Account table.
 *
 * Therefore:
 * - no Demo Chart of Accounts is captured;
 * - no Demo account is published;
 * - no tenant account can be created from this template;
 * - tenant financial data remains tenant-specific.
 */
export async function publishFosTemplate(
  db: Db,
  sourceOrganizationId: string,
  publishedByUserId?: string,
): Promise<FosTemplateSnapshot> {
  const source =
    await db.organization.findUnique({
      where: {
        id: sourceOrganizationId,
      },
      select: {
        id: true,
        name: true,
        templateKey: true,
        templateVersion: true,
      },
    });

  if (!source) {
    throw new Error(
      "Template source organization not found.",
    );
  }

  if (
    source.templateKey !==
    FOS_TEMPLATE_KEY
  ) {
    throw new Error(
      "Organization is not the FOS template source.",
    );
  }

  /**
   * Only configuration is published.
   *
   * CUSTOM memberships are excluded because their permissions
   * are tenant-specific.
   */
  const members =
    await db.organizationMember.findMany({
      where: {
        organizationId: sourceOrganizationId,
        isActive: true,
        NOT: {
          role: "CUSTOM",
        },
      },
      select: {
        role: true,
        permissions: true,
      },
      orderBy: {
        role: "asc",
      },
    });

  const roleMap =
    new Map<string, string[]>();

  for (const member of members) {
    if (
      !roleMap.has(member.role)
    ) {
      roleMap.set(
        member.role,
        stableStrings(
          member.permissions,
        ),
      );
    }
  }

  const snapshot: FosTemplateSnapshot = {
    schemaVersion:
      FOS_TEMPLATE_SCHEMA_VERSION,

    templateKey:
      FOS_TEMPLATE_KEY,

    sourceOrganizationId:
      source.id,

    sourceOrganizationName:
      source.name,

    rolePermissions:
      [...roleMap.entries()].map(
        ([role, permissions]) => ({
          role,
          permissions,
        }),
      ),
  };

  assertTemplate(snapshot);

  const version =
    (source.templateVersion ?? 0) + 1;

  await db.tenantTemplate.create({
    data: {
      templateKey:
        FOS_TEMPLATE_KEY,

      sourceOrganizationId:
        sourceOrganizationId,

      version,

      schemaVersion:
        FOS_TEMPLATE_SCHEMA_VERSION,

      snapshot:
        snapshot as unknown as Prisma.InputJsonValue,

      publishedByUserId:
        publishedByUserId ?? null,
    },
  });

  await db.organization.update({
    where: {
      id: sourceOrganizationId,
    },
    data: {
      templateVersion: version,
    },
  });

  return snapshot;
}

/**
 * Explicitly designates an organization as the FOS
 * template source and publishes its configuration.
 *
 * This does NOT copy Accounts or financial data.
 */
export async function bootstrapDemoAsFosTemplate(
  prisma: PrismaClient,
  demoOrganizationId: string,
  publishedByUserId?: string,
) {
  return prisma.$transaction(
    async (tx) => {
      await setFosTemplateSource(
        tx,
        demoOrganizationId,
      );

      return publishFosTemplate(
        tx,
        demoOrganizationId,
        publishedByUserId,
      );
    },
  );
}

/**
 * Applies the latest FOS configuration template to one tenant.
 *
 * IMPORTANT:
 * There is intentionally NO Account lookup, creation,
 * update, or deletion here.
 *
 * The only synchronized data is standard-role permissions.
 */
export async function applyLatestFosTemplate(
  db: Db,
  organizationId: string,
): Promise<SyncResult> {
  const {
    source,
    template,
    snapshot,
  } = await getLatestTemplate(db);

  if (organizationId === source.id) {
    return {
      skipped: true,
      reason: "template-source",
      templateVersion:
        template.version,
    };
  }

  const target =
    await db.organization.findUnique({
      where: {
        id: organizationId,
      },
      select: {
        id: true,
        status: true,
        templateVersion: true,
      },
    });

  if (!target) {
    throw new Error(
      `Target organization ${organizationId} not found.`,
    );
  }

  if (
    target.status === "SUSPENDED"
  ) {
    return {
      skipped: true,
      reason: "suspended",
      templateVersion:
        template.version,
    };
  }

  if (
    (target.templateVersion ?? 0) >=
    template.version
  ) {
    return {
      skipped: true,
      reason: "up-to-date",
      templateVersion:
        template.version,
    };
  }

  const previousApplication =
    await db.tenantTemplateApplication.findUnique(
      {
        where: {
          organizationId,
        },
      },
    );

  const previous =
    previousApplication?.snapshot as unknown as
      FosTemplateSnapshot | null;

  /**
   * IMPORTANT:
   * We intentionally do not compare, create, update,
   * or delete Account records.
   */

  const oldRoles =
    new Map(
      (previous?.rolePermissions ?? []).map(
        (role) => [
          role.role,
          role.permissions,
        ],
      ),
    );

  const incomingRoles =
    new Map(
      snapshot.rolePermissions.map(
        (role) => [
          role.role,
          role.permissions,
        ],
      ),
    );

  const members =
    await db.organizationMember.findMany({
      where: {
        organizationId,
        isActive: true,
        NOT: {
          role: "CUSTOM",
        },
      },
      select: {
        id: true,
        role: true,
        permissions: true,
      },
    });

  let permissionsUpdated = 0;

  for (const member of members) {
    const incoming =
      incomingRoles.get(
        member.role,
      );

    const old =
      oldRoles.get(
        member.role,
      );

    /**
     * Only change a tenant's permissions when
     * the tenant has not independently changed them
     * since the previous template application.
     */
    if (
      !incoming ||
      !old ||
      !sameStrings(
        member.permissions,
        old,
      )
    ) {
      continue;
    }

    const normalizedIncoming =
      stableStrings(incoming);

    if (
      sameStrings(
        member.permissions,
        normalizedIncoming,
      )
    ) {
      continue;
    }

    await db.organizationMember.update({
      where: {
        id: member.id,
      },
      data: {
        permissions:
          normalizedIncoming,
      },
    });

    permissionsUpdated += 1;
  }

  /**
   * Store the configuration snapshot only.
   *
   * The snapshot contains no Accounts.
   */
  await db.tenantTemplateApplication.upsert({
    where: {
      organizationId,
    },

    create: {
      organizationId,
      templateVersion:
        template.version,
      snapshot:
        snapshot as unknown as Prisma.InputJsonValue,
    },

    update: {
      templateVersion:
        template.version,
      snapshot:
        snapshot as unknown as Prisma.InputJsonValue,
    },
  });

  await db.organization.update({
    where: {
      id: organizationId,
    },
    data: {
      templateVersion:
        template.version,
    },
  });

  return {
    skipped: false,
    templateVersion:
      template.version,
    permissionsUpdated,
  };
}

/**
 * Transaction wrapper for deliberate tenant
 * configuration synchronization.
 *
 * No accounts are created or modified.
 */
export async function applyLatestFosTemplateTransaction(
  prisma: PrismaClient,
  organizationId: string,
) {
  return prisma.$transaction(
    (tx) =>
      applyLatestFosTemplate(
        tx,
        organizationId,
      ),
  );
}

/**
 * Reconciles all eligible tenants with the latest
 * FOS configuration template.
 *
 * IMPORTANT:
 * This only synchronizes configuration.
 * It does not create, update, or delete accounts.
 */
export async function reconcileAllTenantsFromLatestFosTemplate(
  prisma: PrismaClient,
) {
  const {
    source,
    template,
  } = await getLatestTemplate(
    prisma,
  );

  const tenants =
    await prisma.organization.findMany({
      where: {
        id: {
          not: source.id,
        },

        status: {
          not: "SUSPENDED",
        },

        templateVersion: {
          lt: template.version,
        },
      },

      select: {
        id: true,
        name: true,
      },

      orderBy: {
        name: "asc",
      },
    });

  const results:
    Array<Record<string, unknown>> =
    [];

  for (const tenant of tenants) {
    try {
      const result =
        await applyLatestFosTemplateTransaction(
          prisma,
          tenant.id,
        );

      results.push({
        organizationId:
          tenant.id,

        name:
          tenant.name,

        ...result,
      });
    } catch (error) {
      results.push({
        organizationId:
          tenant.id,

        name:
          tenant.name,

        skipped: false,

        failed: true,

        error:
          error instanceof Error
            ? error.message
            : String(error),
      });
    }
  }

  return {
    templateVersion:
      template.version,

    sourceOrganizationId:
      source.id,

    results,
  };
}

/**
 * Returns the current FOS template status.
 *
 * Read-only.
 */
export async function getFosTemplateStatus(
  prisma: PrismaClient,
) {
  const source =
    await getTemplateSource(
      prisma,
    );

  if (!source) {
    return {
      configured: false,
      source: null,
      latestVersion: 0,
      tenants: [],
    };
  }

  const template =
    await prisma.tenantTemplate.findFirst({
      where: {
        sourceOrganizationId:
          source.id,

        templateKey:
          FOS_TEMPLATE_KEY,
      },

      orderBy: {
        version: "desc",
      },

      select: {
        version: true,
        schemaVersion: true,
        publishedAt: true,
      },
    });

  const tenants =
    await prisma.organization.findMany({
      where: {
        id: {
          not: source.id,
        },
      },

      select: {
        id: true,
        name: true,
        status: true,
        templateVersion: true,
      },

      orderBy: {
        name: "asc",
      },
    });

  return {
    configured: true,

    source,

    latestVersion:
      template?.version ?? 0,

    schemaVersion:
      template?.schemaVersion ?? null,

    publishedAt:
      template?.publishedAt ?? null,

    tenants,
  };
}