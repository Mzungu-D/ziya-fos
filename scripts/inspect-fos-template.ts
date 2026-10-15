import prisma from "../server/config/prisma";

async function main() {
  const sources = await prisma.organization.findMany({
    where: { templateKey: "FOS_DEFAULT" },
    select: {
      id: true,
      name: true,
      status: true,
      templateKey: true,
      templateVersion: true,
    },
  });

  const latest = await prisma.tenantTemplate.findFirst({
    where: { templateKey: "FOS_DEFAULT" },
    orderBy: { version: "desc" },
    select: {
      id: true,
      sourceOrganizationId: true,
      version: true,
      schemaVersion: true,
      publishedAt: true,
    },
  });

  console.log(JSON.stringify({ sources, latest }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
