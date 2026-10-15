import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const emails = [
  "doreen.akinyi@ziya.co.ke",
  "zainab.mohamed@ziya.co.ke",
  "lydia.wangui@ziya.co.ke",
  "mwatime.ibrahim@ziya.co.ke",
  "doreen@ziya.co.ke",
  "khadija.orina@ziya.co.ke",
  "edithmaurine220@gmail.com",
  "maurineedith9@gmail.com",
  "anni.hassan@ziya.co.ke",
];

async function main() {
  const users = await prisma.user.findMany({
    where: {
      email: {
        in: emails,
      },
    },
    include: {
      organizationMembers: {
        include: {
          organization: true,
        },
      },
    },
  });

  console.log("\n========== USERS FOUND ==========\n");

  for (const user of users) {
    console.log({
      id: user.id,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      isActive: user.isActive,
      platformRole: user.platformRole,
      organizationMembers: user.organizationMembers.map((m) => ({
        organizationId: m.organizationId,
        organizationName: m.organization.name,
        role: m.role,
        isActive: m.isActive,
        isDefault: m.isDefault,
      })),
    });
  }

  console.log(`\nFound ${users.length} of ${emails.length} requested users.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
