import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log(
    Object.keys(prisma).filter(
      (key) => !key.startsWith("_")
    )
  );
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });