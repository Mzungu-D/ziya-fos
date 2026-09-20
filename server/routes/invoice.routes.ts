import express from "express";

import {
  createInvoice,
  updateInvoice,
  finalizeInvoice,
  getInvoices,
  getInvoiceById,
  deleteInvoice,
  voidInvoice,
  getInvoiceStats,
} from "../controllers/invoice.controller";

import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const router = express.Router();

/* =========================================================
   AUTHENTICATION
========================================================= */

router.use(authenticate);

/* =========================================================
   INVOICE DASHBOARD / STATISTICS
========================================================= */

router.get(
  "/stats",
  requirePermission("invoice.view"),
  getInvoiceStats
);

/* =========================================================
   LIST INVOICES
   Supports:
   ?page=1
   ?pageSize=20
   ?search=customer
   ?status=DRAFT
   ?paymentStatus=UNPAID
========================================================= */

router.get(
  "/",
  requirePermission("invoice.view"),
  getInvoices
);

/* =========================================================
   GET SINGLE INVOICE
========================================================= */

router.get(
  "/:id",
  requirePermission("invoice.view"),
  getInvoiceById
);

/* =========================================================
   CREATE DRAFT INVOICE
========================================================= */

router.post(
  "/",
  requirePermission("invoice.create"),
  createInvoice
);

/* =========================================================
   UPDATE DRAFT INVOICE
========================================================= */

router.patch(
  "/:id",
  requirePermission("invoice.edit"),
  updateInvoice
);

/* =========================================================
   FINALIZE / POST INVOICE
   ---------------------------------------------------------
   Draft
      ↓
   Accounts Receivable
      +
   General Ledger
      +
   Audit Trail
========================================================= */

router.post(
  "/:id/finalize",
  requirePermission("invoice.post"),
  finalizeInvoice
);

/* =========================================================
   VOID POSTED INVOICE
   ---------------------------------------------------------
   Creates accounting reversal.
   Does not delete the invoice.
========================================================= */

router.post(
  "/:id/void",
  requirePermission("invoice.void"),
  voidInvoice
);

/* =========================================================
   DELETE DRAFT INVOICE
========================================================= */

router.delete(
  "/:id",
  requirePermission("invoice.delete"),
  deleteInvoice
);

export default router;