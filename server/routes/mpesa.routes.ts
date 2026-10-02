import { Router, type RequestHandler } from "express";

import {
  configureMpesaAccount,
  updateMpesaAccount,
  getMpesaAccounts,
  getMpesaAccount,
  testExistingMpesaAccount,
  updateMpesaAccountStatus,
  setDefaultMpesaAccount,

  createSinglePayment,
  createBulkPayment,

  createSTKPush,

  handleSTKCallback,
  handleB2CResultCallback,
  handleB2CTimeoutCallback,

  getPaymentBatch,
  getPaymentBatches,

  getMpesaTransactions,
  getMpesaTransaction,

  getMpesaSummary,

  createPaymentHubPayment,
  createPaymentHubBulkPayment,
} from "../controllers/mpesa.controller";

import { authenticate } from "../middleware/auth.middleware";

/**
 * ============================================================================
 * ZIYA FOS — M-PESA ROUTES
 * ============================================================================
 *
 * Production route map:
 *
 * Base URL:
 *   https://ziyafos.com/api/mpesa
 *
 * Authenticated endpoints:
 *   - Require a valid FOS authentication token.
 *   - Tenant isolation is enforced by the controller/service layer.
 *
 * Safaricom callbacks:
 *   - MUST NOT use FOS authentication.
 *   - Safaricom calls these endpoints directly.
 *   - Callback handlers are responsible for locating and validating the
 *     corresponding transaction/account/organization relationship.
 *
 * ============================================================================
 */

/**
 * Express middleware type.
 *
 * Keeping the route handlers explicitly typed makes accidental middleware
 * incompatibilities easier to catch during TypeScript compilation.
 */
const auth: RequestHandler = authenticate as RequestHandler;

const router = Router();

/* ============================================================================
 * SAFARICOM DARAJA CALLBACKS
 * ============================================================================
 *
 * These routes are intentionally unauthenticated.
 *
 * Do NOT add:
 *
 *   authenticate
 *
 * to these routes.
 *
 * Safaricom does not have a Ziya FOS JWT and therefore cannot authenticate
 * against our normal user authentication middleware.
 *
 * Tenant/account validation happens inside the callback handlers.
 * ========================================================================== */

/**
 * B2C result callback.
 *
 * Expected production URL:
 *
 *   POST https://ziyafos.com/api/mpesa/callback/result
 */
router.post(
  "/callback/result",
  handleB2CResultCallback,
);

/**
 * B2C timeout callback.
 *
 * Expected production URL:
 *
 *   POST https://ziyafos.com/api/mpesa/callback/timeout
 */
router.post(
  "/callback/timeout",
  handleB2CTimeoutCallback,
);

/**
 * STK Push callback.
 *
 * Expected production URL:
 *
 *   POST https://ziyafos.com/api/mpesa/callback/stk
 *
 * This URL must match:
 *
 *   MPESA_STK_CALLBACK_URL
 *
 * in the production Railway environment.
 */
router.post(
  "/callback/stk",
  handleSTKCallback,
);

/* ============================================================================
 * M-PESA ACCOUNT MANAGEMENT
 * ============================================================================
 *
 * All account-management operations are authenticated.
 *
 * The controller additionally enforces:
 *
 *   organizationId
 *   permissions
 *   account ownership
 *
 * Therefore a user from Tenant A cannot manage Tenant B's M-Pesa account
 * merely by supplying Tenant B's account ID.
 * ========================================================================== */

/**
 * List the authenticated organization's M-Pesa accounts.
 *
 * GET /api/mpesa/accounts
 */
router.get(
  "/accounts",
  auth,
  getMpesaAccounts,
);

/**
 * Get one M-Pesa account belonging to the authenticated organization.
 *
 * GET /api/mpesa/accounts/:accountId
 */
router.get(
  "/accounts/:accountId",
  auth,
  getMpesaAccount,
);

/**
 * Create a new M-Pesa account configuration.
 *
 * POST /api/mpesa/accounts
 */
router.post(
  "/accounts",
  auth,
  configureMpesaAccount,
);

/**
 * Update an existing M-Pesa account.
 *
 * PATCH /api/mpesa/accounts/:accountId
 */
router.patch(
  "/accounts/:accountId",
  auth,
  updateMpesaAccount,
);

/**
 * Test an existing M-Pesa account connection.
 *
 * POST /api/mpesa/accounts/:accountId/test
 */
router.post(
  "/accounts/:accountId/test",
  auth,
  testExistingMpesaAccount,
);

/**
 * Activate/deactivate an M-Pesa account.
 *
 * PATCH /api/mpesa/accounts/:accountId/status
 */
router.patch(
  "/accounts/:accountId/status",
  auth,
  updateMpesaAccountStatus,
);

/**
 * Make an M-Pesa account the organization's default account.
 *
 * PATCH /api/mpesa/accounts/:accountId/default
 */
router.patch(
  "/accounts/:accountId/default",
  auth,
  setDefaultMpesaAccount,
);

/* ============================================================================
 * STK PUSH
 * ============================================================================
 *
 * Customer payment initiation.
 *
 * POST /api/mpesa/stk-push
 *
 * Required:
 *
 *   - authenticated FOS user
 *   - mpesa:payments permission
 *   - tenant-owned M-Pesa account
 *   - active M-Pesa account
 *   - STK passkey configured
 *
 * The controller performs all of those checks.
 * ========================================================================== */

router.post(
  "/stk-push",
  auth,
  createSTKPush,
);

/* ============================================================================
 * PAYMENT HUB
 * ============================================================================
 *
 * Payment Hub is the unified outbound payment interface.
 * ========================================================================== */

/**
 * Create a single Payment Hub payment.
 *
 * POST /api/mpesa/payment-hub
 */
router.post(
  "/payment-hub",
  auth,
  createPaymentHubPayment,
);

/**
 * Create a bulk Payment Hub batch.
 *
 * POST /api/mpesa/payment-hub/bulk
 */
router.post(
  "/payment-hub/bulk",
  auth,
  createPaymentHubBulkPayment,
);

/* ============================================================================
 * B2C PAYMENTS
 * ============================================================================
 *
 * Existing outbound B2C payment functionality.
 * ========================================================================== */

/**
 * Create a single B2C payment.
 *
 * POST /api/mpesa/payments
 */
router.post(
  "/payments",
  auth,
  createSinglePayment,
);

/**
 * Create a bulk B2C payment.
 *
 * POST /api/mpesa/payments/bulk
 */
router.post(
  "/payments/bulk",
  auth,
  createBulkPayment,
);

/* ============================================================================
 * PAYMENT BATCHES
 * ============================================================================
 */

/**
 * List payment batches belonging to the authenticated organization.
 *
 * GET /api/mpesa/batches
 */
router.get(
  "/batches",
  auth,
  getPaymentBatches,
);

/**
 * Get a specific payment batch.
 *
 * GET /api/mpesa/batches/:batchId
 */
router.get(
  "/batches/:batchId",
  auth,
  getPaymentBatch,
);

/* ============================================================================
 * M-PESA TRANSACTIONS
 * ============================================================================
 */

/**
 * List M-Pesa transactions belonging to the authenticated organization.
 *
 * GET /api/mpesa/transactions
 */
router.get(
  "/transactions",
  auth,
  getMpesaTransactions,
);

/**
 * Get one M-Pesa transaction.
 *
 * GET /api/mpesa/transactions/:transactionId
 */
router.get(
  "/transactions/:transactionId",
  auth,
  getMpesaTransaction,
);

/* ============================================================================
 * M-PESA SUMMARY
 * ============================================================================
 */

/**
 * Get the authenticated organization's M-Pesa summary.
 *
 * GET /api/mpesa/summary
 */
router.get(
  "/summary",
  auth,
  getMpesaSummary,
);

/* ============================================================================
 * EXPORT
 * ============================================================================
 */

export default router;