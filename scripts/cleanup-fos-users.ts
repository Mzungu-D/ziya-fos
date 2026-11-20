import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TARGET_USER_ID = "cmvf73pld001dnv4heiwk05vp";
const TARGET_EMAIL = "doreen.akinyi@ziya.co.ke";
const TARGET_PHONE = "254750555476";
const TARGET_ORG_ID = "cmumjrklf0035lm4hse8xr933";
const EXECUTE = process.argv.includes("--execute");

async function main() {
  console.log("Doreen Akinyi — targeted FOS reset");
  console.log(`Mode: ${EXECUTE ? "EXECUTE" : "DRY RUN"}`);

  const user = await prisma.user.findUnique({
    where: { id: TARGET_USER_ID },
    include: { memberships: true },
  });

  if (!user || user.email.toLowerCase() !== TARGET_EMAIL) {
    throw new Error("Identity verification failed. No changes made.");
  }

  if (user.phoneNumber !== TARGET_PHONE) {
    throw new Error("Phone verification failed. No changes made.");
  }

  const targetMemberships = user.memberships.filter(
    (m) => m.organizationId === TARGET_ORG_ID
  );
  const otherMemberships = user.memberships.filter(
    (m) => m.organizationId !== TARGET_ORG_ID
  );

  if (targetMemberships.length !== 1) {
    throw new Error(
      `Expected exactly one Ziya Bridge membership; found ${targetMemberships.length}. No changes made.`
    );
  }

  if (otherMemberships.length > 0) {
    throw new Error(
      `Doreen belongs to ${otherMemberships.length} other tenant(s). ` +
      "Global account deletion aborted to protect their access. No changes made."
    );
  }

  const invitations = await prisma.organizationInvitation.findMany({
    where: {
      organizationId: TARGET_ORG_ID,
      OR: [
        { email: TARGET_EMAIL },
        { phoneNumber: TARGET_PHONE },
      ],
    },
    select: { id: true, email: true, phoneNumber: true, status: true },
  });

  console.log(`Verified: ${user.name} <${user.email}>`);
  console.log(`Tenant: Ziya Bridge Limited (${TARGET_ORG_ID})`);
  console.log(`Target membership: ${targetMemberships.length}`);
  console.log(`Matching tenant invitations: ${invitations.length}`);

  if (!EXECUTE) {
    console.log("\nDRY RUN ONLY — nothing has been changed.");
    console.log("Review the checks, then rerun with --execute to proceed.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    // Recheck identity and tenant membership inside the transaction.
    const current = await tx.user.findUnique({
      where: { id: TARGET_USER_ID },
      include: { memberships: true },
    });

    if (
      !current ||
      current.email.toLowerCase() !== TARGET_EMAIL ||
      current.phoneNumber !== TARGET_PHONE ||
      current.memberships.length !== 1 ||
      current.memberships[0].organizationId !== TARGET_ORG_ID
    ) {
      throw new Error("Safety recheck failed. Transaction cancelled.");
    }

    // Invitations are restricted to Doreen's identity AND target tenant.
    await tx.organizationInvitation.deleteMany({
      where: {
        organizationId: TARGET_ORG_ID,
        OR: [
          { email: TARGET_EMAIL },
          { phoneNumber: TARGET_PHONE },
        ],
      },
    });

    await tx.otpVerification.deleteMany({
      where: {
        OR: [
          { userId: TARGET_USER_ID },
          { email: TARGET_EMAIL },
          { phoneNumber: TARGET_PHONE },
        ],
      },
    });

    await tx.session.deleteMany({
      where: { userId: TARGET_USER_ID },
    });

    await tx.organizationMember.delete({
      where: { id: targetMemberships[0].id },
    });

    // Delete only Doreen's global identity, after confirming no other memberships.
    await tx.user.delete({
      where: { id: TARGET_USER_ID },
    });
  });

  console.log("\nReset completed for Doreen Akinyi only.");
  console.log("No organization or financial records were targeted.");
  console.log("Create her fresh invitation from Ziya Bridge's Users & Access page.");
}

main()
  .catch((error) => {
    console.error("\nRESET ABORTED:", error.message ?? error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
