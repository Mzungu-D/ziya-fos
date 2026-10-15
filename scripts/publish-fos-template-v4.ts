import prisma from "../server/config/prisma";
import { publishFosTemplate } from "../server/services/fosConfigurationTemplate.service";

async function main() {
  const source = await prisma.organization.findFirst({
    where: {
      templateKey: "FOS_DEFAULT",
    },
    select: {
      id: true,
      name: true,
      status: true,
      templateVersion: true,
    },
  });

  if (!source) {
    throw new Error("FOS_DEFAULT template source was not found.");
  }

  if (source.status === "SUSPENDED") {
    throw new Error(`Template source ${source.name} is suspended.`);
  }

  console.log("FOS TEMPLATE SOURCE");
  console.log(JSON.stringify(source, null, 2));
  console.log("");
  console.log("Publishing current FOS template as schema version 4...");

  const template = await publishFosTemplate(
    prisma,
    source.id,
  );

  console.log("");
  console.log("FOS TEMPLATE PUBLISHED SUCCESSFULLY");
  console.log(JSON.stringify(template, null, 2));
}

main()
  .catch((error) => {
    console.error("FOS TEMPLATE PUBLISH FAILED");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
