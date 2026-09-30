import app from "./app";
import prisma from "./config/prisma";
import {
  FOS_BASELINE_VERSION,
} from "./config/fosBaseline";
import {
  applyTenantBaseline,
} from "./services/tenantBaseline.service";

const PORT = Number(process.env.PORT || 5000);

/**
 * Ziya FOS
 * Production server bootstrap.
 *
 * IMPORTANT:
 * - The FOS baseline is GLOBAL.
 * - Demo Company is never used as a source of truth.
 * - Every existing organization is reconciled against the
 *   currently deployed global baseline before the API starts.
 * - New organizations are separately provisioned through the
 *   tenant creation/registration flows.
 *
 * This makes deployment deterministic:
 *
 *   Global baseline
 *          ↓
 *   Existing tenants
 *          ↓
 *   Reconcile to current baseline
 *
 * No tenant's financial transactions, customers, vendors,
 * employees, or other business data are copied between
 * organizations.
 */

async function reconcileExistingTenants(): Promise<void> {
  console.log(
    `[BASELINE] Starting tenant reconciliation for FOS baseline v${FOS_BASELINE_VERSION}...`
  );

  const organizations =
    await prisma.organization.findMany({
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

  let processed = 0;
  let updated = 0;
  let accountsCreated = 0;
  let membershipsSynchronized = 0;

  for (const organization of organizations) {
    console.log(
      `[BASELINE] Reconciling "${organization.name}" (${organization.id}) ` +
        `from v${organization.baselineVersion} to v${FOS_BASELINE_VERSION}...`
    );

    const result = await prisma.$transaction(
      async (tx) => {
        return applyTenantBaseline(
          tx,
          organization.id
        );
      }
    );

    processed++;

    if (
      result.previousBaselineVersion !==
      result.baselineVersion
    ) {
      updated++;
    }

    accountsCreated +=
      result.chartOfAccounts.createdCount;

    membershipsSynchronized +=
      result.membershipsSynchronized;

    console.log(
      `[BASELINE] "${organization.name}" complete: ` +
        `v${result.previousBaselineVersion} → v${result.baselineVersion}, ` +
        `accounts added=${result.chartOfAccounts.createdCount}, ` +
        `memberships synchronized=${result.membershipsSynchronized}`
    );
  }

  console.log(
    `[BASELINE] Tenant reconciliation completed successfully. ` +
      `Processed=${processed}, ` +
      `Updated=${updated}, ` +
      `Accounts added=${accountsCreated}, ` +
      `Memberships synchronized=${membershipsSynchronized}.`
  );
}

/**
 * Start the FOS API only after the database baseline
 * reconciliation has completed successfully.
 *
 * If reconciliation fails, the application does NOT
 * start serving requests. This prevents tenants from
 * receiving a partially initialized application state.
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

    await prisma.$disconnect();

    process.exit(1);
  }
}

void startServer();