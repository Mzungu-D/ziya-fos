import {
  Router,
} from "express";

import {
  authenticate,
} from "../middleware/auth.middleware";

import {
  requirePermission,
} from "../middleware/permission.middleware";

import {
  runFraudDetection,
  listFraudAlerts,
  fraudSummary,
} from "../controllers/fraudDetection.controller";

const router =
  Router();

/*
 * Every fraud route requires:
 *
 * 1. Valid authenticated session
 * 2. TENANT session
 * 3. Active membership
 * 4. Active organization
 * 5. Appropriate tenant permission
 */

router.get(
  "/",
  authenticate,
  requirePermission(
    "fraud.view"
  ),
  listFraudAlerts
);

router.get(
  "/summary",
  authenticate,
  requirePermission(
    "fraud.view"
  ),
  fraudSummary
);

router.post(
  "/scan",
  authenticate,
  requirePermission(
    "fraud.analyze"
  ),
  runFraudDetection
);

export default router;