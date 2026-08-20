import express from "express";

import {
  runFraudDetection,
  listFraudAlerts,
  fraudSummary,
} from "../controllers/fraudDetection.controller";

import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";

const router = express.Router();

/* =========================================================
   FRAUD DETECTION
========================================================= */

/*
 * All fraud detection routes require:
 *
 * 1. Authentication
 * 2. Active tenant membership
 * 3. Active organization
 * 4. Appropriate tenant permission
 */

/* =========================================================
   GET FRAUD ALERTS
========================================================= */

router.get(
  "/",
  authenticate,
  requirePermission("fraud.view"),
  listFraudAlerts
);

/* =========================================================
   GET FRAUD SUMMARY
========================================================= */

router.get(
  "/summary",
  authenticate,
  requirePermission("fraud.view"),
  fraudSummary
);

/* =========================================================
   RUN FRAUD DETECTION
========================================================= */

router.post(
  "/scan",
  authenticate,
  requirePermission("fraud.analyze"),
  runFraudDetection
);

export default router;