/* =========================================================
   BACKFILL ACCOUNT SUBTYPES FOR EVERY TENANT

   Dry run (default):  npx tsx scripts/backfill-account-subtypes.ts
   Apply:              npx tsx scripts/backfill-account-subtypes.ts --apply

   Tags standard accounts (receivables, payables, tax payable,
   sales revenue, bad debt, petty cash) ONLY when the account
   still has its standard code AND a matching name AND nobody in
   that organization already holds the role. Anything else is
   listed for manual review - nothing is guessed.
========================================================= */

import prisma from "../server/config/prisma";
import { STANDARD_TAGS, SINGLETON_SUBTYPES } from "../server/services/accountRoles.service";

const apply = process.argv.includes("--apply");

async function main() {
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  let tagged = 0;
  let review = 0;

  console.log(`\n${apply ? "APPLYING" : "DRY RUN"} - ${orgs.length} organizations\n`);

  for (const org of orgs) {
    for (const tag of STANDARD_TAGS) {
      if (SINGLETON_SUBTYPES.has(tag.subtype)) {
        const taken = await prisma.account.count({ where: { organizationId: org.id, subtype: tag.subtype } });
        if (taken > 0) continue;
      }

      const account = await prisma.account.findFirst({
        where: { organizationId: org.id, code: tag.code, type: tag.type, subtype: null },
        select: { id: true, code: true, name: true },
      });

      if (!account) {
        if (tag.subtype !== "CASH") {
          review += 1;
          console.log(`  REVIEW  ${org.name}: no account ${tag.code} for ${tag.subtype} - tag one manually`);
        }
        continue;
      }

      if (!tag.name.test(account.name)) {
        review += 1;
        console.log(`  REVIEW  ${org.name}: ${account.code} is named "${account.name}", expected ${tag.subtype}`);
        continue;
      }

      console.log(`  TAG     ${org.name}: ${account.code} ${account.name} -> ${tag.subtype}`);
      if (apply) await prisma.account.update({ where: { id: account.id }, data: { subtype: tag.subtype } });
      tagged += 1;
    }
  }

  console.log(`\n${tagged} account(s) ${apply ? "tagged" : "would be tagged"}, ${review} need manual review.\n`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});