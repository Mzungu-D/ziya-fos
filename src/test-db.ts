import prisma from "./lib/prisma";

async function main() {
  const users = await prisma.user.findMany();

  console.log("Database connection successful.");
  console.log(users);
}

main()
  .catch((error) => {
    console.error("Database connection failed:");
    console.error(error);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });