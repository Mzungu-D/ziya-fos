import express from "express";

import {
  createInvoice,
  getInvoices,
  getInvoiceById,
} from "../controllers/invoice.controller";

import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const router = express.Router();

router.use(authenticate);

router.get(
  "/",
  requirePermission("invoice.view"),
  getInvoices
);

router.get(
  "/:id",
  requirePermission("invoice.view"),
  getInvoiceById
);

router.post(
  "/",
  requirePermission("invoice.create"),
  createInvoice
);

export default router;