import prisma from "../server/config/prisma";
import {
  ensureTenantBaseline,
} from "../server/services/tenantProvisioning.service";

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

  console.log(
    `Tenant baseline repair started: ${organizations.length} organizations`
  );

  let failed = 0;

  for (const organization of organizations) {
    try {
      const result = await ensureTenantBaseline(
        prisma,
        organization.id
      );

      const owners = await prisma.organizationMember.findMany({
        where: {
          organizationId: organization.id,
          role: "OWNER",
        },
        select: {
          permissions: true,
        },
      });

      const ownerPermissionsValid = owners.every(
        (owner) =>
          owner.permissions.length === 1 &&
          owner.permissions[0] === "*"
      );

      if (!ownerPermissionsValid) {
        throw new Error(
          `OWNER permission verification failed for ${organization.name}.`
        );
      }

      console.log(`[OK] ${organization.name} (${organization.id})`);
      console.log(
        `     chartCreated=${result.chartOfAccounts.createdCount}`
      );
      console.log(
        `     standardAccounts=${result.chartOfAccounts.totalStandardAccounts}`
      );
      console.log(
        `     membershipsSynchronized=${result.membershipsSynchronized}`
      );
      console.log(`     ownerPermissions=VALID (*)`);
    } catch (error) {
      failed += 1;

      console.error(
        `[FAILED] ${organization.name} (${organization.id})`
      );
      console.error(error);
    }
  }

  if (failed > 0) {
    throw new Error(
      `${failed} organization(s) failed tenant baseline repair.`
    );
  }

  console.log("");
  console.log(
    "Tenant baseline repair completed successfully."
  );
}

main()
  .catch((error) => {
    console.error("");
    console.error("TENANT BASELINE REPAIR FAILED:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });