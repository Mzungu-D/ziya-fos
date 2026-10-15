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

async function cleanupUser(user: {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
}) {
  console.log(`\nCleaning: ${user.name} <${user.email}>`);
  console.log(`User ID: ${user.id}`);
  console.log(`Phone: ${user.phoneNumber ?? "None"}`);

  // Remove invitations belonging to this user's email.
  const invitationsByEmail =
    await prisma.organizationInvitation.deleteMany({
      where: {
        email: user.email,
      },
    });

  // Remove invitations belonging to this user's phone number.
  let invitationsByPhone = { count: 0 };

  if (user.phoneNumber) {
    invitationsByPhone =
      await prisma.organizationInvitation.deleteMany({
        where: {
          phoneNumber: user.phoneNumber,
        },
      });
  }

  // Remove invitations created by this user.
  const invitationsCreatedByUser =
    await prisma.organizationInvitation.deleteMany({
      where: {
        invitedByUserId: user.id,
      },
    });

  // Remove OTP/authentication records.
  const otp = await prisma.otpVerification.deleteMany({
    where: {
      OR: [
        { userId: user.id },
        { email: user.email },
        ...(user.phoneNumber
          ? [{ phoneNumber: user.phoneNumber }]
          : []),
      ],
    },
  });

  // Remove tenant memberships.
  const memberships =
    await prisma.organizationMember.deleteMany({
      where: {
        userId: user.id,
      },
    });

  // Remove active/inactive sessions.
  const sessions = await prisma.session.deleteMany({
    where: {
      userId: user.id,
    },
  });

  // Finally remove the User itself.
  // This removes the person's global identity, including
  // their stored phone number, email, password, etc.
  await prisma.user.delete({
    where: {
      id: user.id,
    },
  });

  console.log(
    `  ? Invitations by email: ${invitationsByEmail.count}`
  );
  console.log(
    `  ? Invitations by phone: ${invitationsByPhone.count}`
  );
  console.log(
    `  ? Invitations created by user: ${invitationsCreatedByUser.count}`
  );
  console.log(`  ? OTP records: ${otp.count}`);
  console.log(`  ? Memberships: ${memberships.count}`);
  console.log(`  ? Sessions: ${sessions.count}`);
  console.log(`  ? User record deleted`);
  console.log(`  ? Phone number released`);
}

async function main() {
  console.log("\n========================================");
  console.log("ZIYA FOS USER RESET");
  console.log("========================================\n");

  const users = await prisma.user.findMany({
    where: {
      email: {
        in: emails,
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      phoneNumber: true,
      isActive: true,
      platformRole: true,
      memberships: {
        select: {
          id: true,
          organizationId: true,
          organization: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  console.log(
    `Found ${users.length} of ${emails.length} requested users.`
  );

  if (users.length === 0) {
    console.log("\nNo matching users found.");
    return;
  }

  console.log("\nAccounts scheduled for reset:\n");

  for (const user of users) {
    console.log(
      `- ${user.name} | ${user.email} | Phone: ${
        user.phoneNumber ?? "None"
      }`
    );

    if (user.memberships.length > 0) {
      console.log(
        `  Tenants: ${user.memberships
          .map((m) => m.organization.name)
          .join(", ")}`
      );
    } else {
      console.log("  Tenants: None");
    }
  }

  console.log("\n========================================");
  console.log("BEGINNING CLEANUP");
  console.log("========================================");

  let success = 0;
  let failed = 0;

  for (const user of users) {
    try {
      await cleanupUser(user);
      success++;
    } catch (error) {
      failed++;

      console.error(
        `\n  ? FAILED: ${user.email}`
      );

      console.error(error);

      console.error(
        "\nStopping cleanup to prevent unintended changes."
      );

      break;
    }
  }

  console.log("\n========================================");
  console.log("CLEANUP SUMMARY");
  console.log("========================================");

  console.log(`Successfully removed: ${success}`);
  console.log(`Failed:               ${failed}`);

  if (failed === 0) {
    console.log(
      "\n? All requested user accounts were reset successfully."
    );
    console.log(
      "? Their old tenant memberships were removed."
    );
    console.log(
      "? Their sessions were removed."
    );
    console.log(
      "? Their OTP records were removed."
    );
    console.log(
      "? Their invitation records were removed."
    );
    console.log(
      "? Their old phone numbers are no longer stored on User records."
    );
  }
}

main()
  .catch((error) => {
    console.error("\nFATAL ERROR:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
