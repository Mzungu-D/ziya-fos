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

const phones = [
  "0750555476",
  "+254727487654",
  "+254750555435",
  "+254796695786",
  "+254717485321",
  "0725542733",
  "0796555441",
  "0742109398",
];

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { in: emails } },
        { phoneNumber: { in: phones } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      phoneNumber: true,
    },
  });

  const invitations = await prisma.organizationInvitation.findMany({
    where: {
      OR: [
        { email: { in: emails } },
        { phoneNumber: { in: phones } },
      ],
    },
    select: {
      id: true,
      email: true,
      phoneNumber: true,
      status: true,
    },
  });

  console.log("\n========================================");
  console.log("FOS USER RESET VERIFICATION");
  console.log("========================================");

  console.log(`\nUsers still found: ${users.length}`);
  console.log(`Invitations still found: ${invitations.length}`);

  if (users.length > 0) {
    console.log("\nUSERS STILL PRESENT:");
    console.dir(users, { depth: null });
  }

  if (invitations.length > 0) {
    console.log("\nINVITATIONS STILL PRESENT:");
    console.dir(invitations, { depth: null });
  }

  if (users.length === 0 && invitations.length === 0) {
    console.log("\n? CLEAN");
    console.log("? None of the 9 old User accounts remain.");
    console.log("? None of their old invitations remain.");
    console.log("? They are ready to be invited again.");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
