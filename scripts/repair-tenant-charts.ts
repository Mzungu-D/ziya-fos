import prisma from "../server/config/prisma";
import { ensureStandardChartOfAccounts } from "../server/services/chartOfAccounts.service";

async function main() {
  const organizations = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      status: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  console.log(`Found ${organizations.length} organizations.`);

  for (const organization of organizations) {
    try {
      const result = await ensureStandardChartOfAccounts(
        prisma,
        organization.id
      );

      console.log(
        `[OK] ${organization.name} (${organization.id}) | ` +
          `created: ${result.createdCount} | ` +
          `standard accounts: ${result.totalStandardAccounts}`
      );
    } catch (error) {
      console.error(
        `[FAILED] ${organization.name} (${organization.id})`,
        error
      );
    }
  }
}

main()
  .catch((error) => {
    console.error("TENANT CHART REPAIR FAILED:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });