// server/routes/mpesa.routes.ts

import { Router } from "express";

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

  handleB2CResultCallback,
  handleB2CTimeoutCallback,

  getPaymentBatch,
  getPaymentBatches,

  getMpesaTransactions,
  getMpesaTransaction,

  getMpesaSummary,
} from "../controllers/mpesa.controller";

// Use the authentication middleware already used by Ziya FOS.
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

/*
|--------------------------------------------------------------------------
| M-PESA CALLBACKS
|--------------------------------------------------------------------------
|
| These endpoints are called by Safaricom/Daraja.
|
| They must NOT require the normal application JWT because
| Safaricom does not have a Ziya FOS user account.
|
*/

router.post(
  "/callback/result",
  handleB2CResultCallback
);

router.post(
  "/callback/timeout",
  handleB2CTimeoutCallback
);

/*
|--------------------------------------------------------------------------
| M-PESA ACCOUNT CONFIGURATION
|--------------------------------------------------------------------------
|
| Tenant administrators configure their own M-Pesa account here.
|
| Credentials are supplied by the tenant and encrypted by
| mpesa.controller.ts before being stored.
|
*/

/**
 * GET /api/mpesa/accounts
 */
router.get(
  "/accounts",
  authenticate,
  getMpesaAccounts
);

/**
 * GET /api/mpesa/accounts/:accountId
 */
router.get(
  "/accounts/:accountId",
  authenticate,
  getMpesaAccount
);

/**
 * POST /api/mpesa/accounts
 */
router.post(
  "/accounts",
  authenticate,
  configureMpesaAccount
);

/**
 * PATCH /api/mpesa/accounts/:accountId
 */
router.patch(
  "/accounts/:accountId",
  authenticate,
  updateMpesaAccount
);

/**
 * POST /api/mpesa/accounts/:accountId/test
 */
router.post(
  "/accounts/:accountId/test",
  authenticate,
  testExistingMpesaAccount
);

/**
 * PATCH /api/mpesa/accounts/:accountId/status
 */
router.patch(
  "/accounts/:accountId/status",
  authenticate,
  updateMpesaAccountStatus
);

/**
 * PATCH /api/mpesa/accounts/:accountId/default
 */
router.patch(
  "/accounts/:accountId/default",
  authenticate,
  setDefaultMpesaAccount
);

/*
|--------------------------------------------------------------------------
| PAYMENTS / DISBURSEMENTS
|--------------------------------------------------------------------------
|
| B2C is used to send money from the tenant's M-Pesa business
| account to recipients.
|
*/

/**
 * POST /api/mpesa/payments
 *
 * Single payment.
 */
router.post(
  "/payments",
  authenticate,
  createSinglePayment
);

/**
 * POST /api/mpesa/payments/bulk
 *
 * Bulk payment.
 *
 * Each recipient can have a different amount.
 */
router.post(
  "/payments/bulk",
  authenticate,
  createBulkPayment
);

/*
|--------------------------------------------------------------------------
| PAYMENT BATCHES
|--------------------------------------------------------------------------
*/

/**
 * GET /api/mpesa/batches
 */
router.get(
  "/batches",
  authenticate,
  getPaymentBatches
);

/**
 * GET /api/mpesa/batches/:batchId
 */
router.get(
  "/batches/:batchId",
  authenticate,
  getPaymentBatch
);

/*
|--------------------------------------------------------------------------
| TRANSACTIONS
|--------------------------------------------------------------------------
*/

/**
 * GET /api/mpesa/transactions
 */
router.get(
  "/transactions",
  authenticate,
  getMpesaTransactions
);

/**
 * GET /api/mpesa/transactions/:transactionId
 */
router.get(
  "/transactions/:transactionId",
  authenticate,
  getMpesaTransaction
);

/*
|--------------------------------------------------------------------------
| M-PESA SUMMARY
|--------------------------------------------------------------------------
*/

/**
 * GET /api/mpesa/summary
 */
router.get(
  "/summary",
  authenticate,
  getMpesaSummary
);

export default router;