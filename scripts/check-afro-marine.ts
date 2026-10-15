import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("\n========================================");
  console.log("AFRO MARINE ORGANIZATION CHECK");
  console.log("READ ONLY - NO DATA WILL BE CHANGED");
  console.log("========================================\n");

  const organizations = await prisma.organization.findMany({
    where: {
      name: {
        contains: "Afro Marine",
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      name: true,
      legalName: true,
      status: true,
      createdAt: true,
      memberships: {
        select: {
          id: true,
          role: true,
          isActive: true,
          isDefault: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phoneNumber: true,
              isActive: true,
              platformRole: true,
            },
          },
        },
      },
    },
  });

  if (organizations.length === 0) {
    console.log("? NO ORGANIZATION MATCHING 'Afro Marine' WAS FOUND.");
    return;
  }

  console.log(`? Found ${organizations.length} organization(s).\n`);

  for (const organization of organizations) {
    console.log("----------------------------------------");
    console.log(`Organization : ${organization.name}`);
    console.log(`Legal Name   : ${organization.legalName ?? "N/A"}`);
    console.log(`ID           : ${organization.id}`);
    console.log(`Status       : ${organization.status}`);
    console.log(`Created      : ${organization.createdAt}`);
    console.log(`Members      : ${organization.memberships.length}`);
    console.log("----------------------------------------");

    for (const membership of organization.memberships) {
      console.log({
        membershipId: membership.id,
        name: membership.user.name,
        email: membership.user.email,
        phone: membership.user.phoneNumber,
        role: membership.role,
        membershipActive: membership.isActive,
        default: membership.isDefault,
        userActive: membership.user.isActive,
        platformRole: membership.user.platformRole,
      });
    }

    console.log("");
  }

  console.log("========================================");
  console.log("CHECK COMPLETE - NO CHANGES MADE");
  console.log("========================================");
}

main()
  .catch((error) => {
    console.error("\nERROR:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
