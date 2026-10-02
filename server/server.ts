import app from "./app";
import prisma from "./config/prisma";
import { FOS_BASELINE_VERSION } from "./config/fosBaseline";
import {
  applyTenantBaselineTransaction,
} from "./services/tenantBaseline.service";

const PORT = Number(process.env.PORT || 5000);

/**
 * Ziya FOS
 * Production server bootstrap.
 *
 * GLOBAL BASELINE MODEL
 * ---------------------
 *
 * The deployed FOS code and baseline configuration are the
 * source of truth for application-wide configuration.
 *
 * Demo Company is NOT a source of truth.
 *
 * Tenant-specific financial and operational data remains
 * isolated by organizationId and is never copied between
 * organizations.
 *
 * Existing tenants are reconciled only when their stored
 * baselineVersion is behind the currently deployed baseline.
 *
 * New tenants are provisioned through the normal tenant
 * provisioning flow.
 *
 * IMPORTANT:
 * Tenant baseline reconciliation MUST NOT create, copy,
 * modify, or delete tenant financial/business data.
 */
async function reconcileExistingTenants(): Promise<void> {
  console.log(
    `[BASELINE] Checking existing tenants against FOS baseline v${FOS_BASELINE_VERSION}...`
  );

  const organizations = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      baselineVersion: true,
    },

    orderBy: {
      createdAt: "asc",
    },
  });

  if (organizations.length === 0) {
    console.log(
      "[BASELINE] No organizations found. Nothing to reconcile."
    );

    return;
  }

  console.log(
    `[BASELINE] Found ${organizations.length} organization(s).`
  );

  const organizationsNeedingUpdate = organizations.filter(
    (organization) =>
      organization.baselineVersion < FOS_BASELINE_VERSION
  );

  if (organizationsNeedingUpdate.length === 0) {
    console.log(
      `[BASELINE] All ${organizations.length} organization(s) are already on baseline v${FOS_BASELINE_VERSION}.`
    );

    return;
  }

  console.log(
    `[BASELINE] ${organizationsNeedingUpdate.length} organization(s) require baseline updates.`
  );

  let processed = 0;
  let updated = 0;
  let membershipsSynchronized = 0;
  let customMembershipsSkipped = 0;

  for (const organization of organizationsNeedingUpdate) {
    console.log(
      `[BASELINE] Reconciling "${organization.name}" (${organization.id}) ` +
        `from v${organization.baselineVersion} to v${FOS_BASELINE_VERSION}...`
    );

    const result =
      await applyTenantBaselineTransaction(
        prisma,
        organization.id
      );

    processed++;

    if (
      result.previousBaselineVersion !==
      result.baselineVersion
    ) {
      updated++;
    }

    membershipsSynchronized +=
      result.membershipsSynchronized;

    customMembershipsSkipped +=
      result.skippedCustomMemberships;

    console.log(
      `[BASELINE] "${organization.name}" complete: ` +
        `v${result.previousBaselineVersion} → v${result.baselineVersion}, ` +
        `memberships synchronized=${result.membershipsSynchronized}, ` +
        `custom memberships preserved=${result.skippedCustomMemberships}`
    );
  }

  console.log(
    `[BASELINE] Tenant reconciliation completed successfully. ` +
      `Processed=${processed}, ` +
      `Updated=${updated}, ` +
      `Memberships synchronized=${membershipsSynchronized}, ` +
      `Custom memberships preserved=${customMembershipsSkipped}.`
  );
}

/**
 * Start the FOS API only after required tenant baseline
 * reconciliation has completed successfully.
 *
 * If a required tenant baseline update fails, the API does
 * not start serving requests.
 */
async function startServer(): Promise<void> {
  try {
    await prisma.$connect();

    console.log(
      "[DATABASE] PostgreSQL connection established."
    );

    await reconcileExistingTenants();

    app.listen(PORT, () => {
      console.log(
        `🚀 Ziya FOS API running on port ${PORT}`
      );

      console.log(
        `[BASELINE] Global FOS baseline v${FOS_BASELINE_VERSION} is active.`
      );
    });
  } catch (error) {
    console.error(
      "[STARTUP] Ziya FOS failed to start.",
      error
    );

    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error(
        "[DATABASE] Failed to disconnect Prisma cleanly.",
        disconnectError
      );
    }

    process.exit(1);
  }
}

void startServer();