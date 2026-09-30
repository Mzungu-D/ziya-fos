import { PrismaClient } from "@prisma/client";

import {
  ensureStandardChartOfAccounts,
} from "../server/services/chartOfAccounts.service";

const prisma = new PrismaClient();

/**
 * Ziya FOS
 * Production-safe database seed.
 *
 * IMPORTANT:
 * - The canonical Chart of Accounts lives in:
 *
 *     server/services/chartOfAccounts.service.ts
 *
 * - This file must NOT maintain a second Chart of Accounts definition.
 * - This seed is tenant-aware.
 * - Existing tenant accounts are never overwritten.
 * - Demo Company is not treated specially.
 * - Financial transactions, customers, vendors, employees, etc.
 *   are never copied or created here.
 *
 * The seed is intentionally safe to run against a database containing
 * existing organizations.
 */

async function main(): Promise<void> {
  console.log("Starting Ziya FOS database seed...");

  const organizations = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      baselineVersion: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (organizations.length === 0) {
    console.log(
      "No organizations found. No tenant Chart of Accounts were created."
    );

    return;
  }

  console.log(
    `Found ${organizations.length} organization(s).`
  );

  let organizationsProcessed = 0;
  let accountsCreated = 0;

  for (const organization of organizations) {
    console.log(
      `Processing tenant: ${organization.name} (${organization.id})`
    );

    const result =
      await ensureStandardChartOfAccounts(
        prisma,
        organization.id
      );

    organizationsProcessed++;
    accountsCreated += result.createdCount;

    console.log(
      `  Standard accounts added: ${result.createdCount}`
    );

    console.log(
      `  Standard accounts present: ${result.totalStandardAccounts}`
    );
  }

  console.log("");
  console.log("Ziya FOS database seed completed.");
  console.log(
    `Organizations processed: ${organizationsProcessed}`
  );
  console.log(
    `Standard accounts created: ${accountsCreated}`
  );
}

main()
  .catch((error: unknown) => {
    console.error(
      "Ziya FOS database seed failed:",
      error
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });